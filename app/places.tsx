/**
 * Places: photos with GPS on an OpenStreetMap map (Leaflet in a WebView — no
 * Maps API key or billing). Pins cluster when zoomed out; tap a pin or cluster
 * to list those photos in a strip, tap one to open it.
 *
 * Thumbnails need the Drive auth header, so they're drawn natively in the strip
 * rather than inside the web map. react-native-webview is required lazily.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoTile } from '@/components/PhotoTile';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useMediaItems } from '@/hooks/useMedia';
import { useIndexStatus } from '@/lib/indexSync';
import type { MediaItem } from '@/lib/types';

type WebViewType = typeof import('react-native-webview').WebView;

function loadWebView(): WebViewType | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('react-native-webview') as typeof import('react-native-webview')).WebView;
  } catch {
    return null;
  }
}

export default function Places() {
  const { palette, name } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items } = useMediaItems();
  const indexing = useIndexStatus((s) => s.phase !== 'idle');
  const [WebView] = useState(loadWebView);
  const [selected, setSelected] = useState<string[]>([]);

  const located = useMemo(() => items.filter((i) => i.lat != null && i.lng != null), [items]);
  const byId = useMemo(() => new Map(located.map((i) => [i.id, i])), [located]);
  const picked = selected.map((id) => byId.get(id)).filter((i): i is MediaItem => !!i);

  const html = useMemo(() => mapHtml(located, name === 'twilight'), [located, name]);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={palette.fg} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[type.headlineLg, { color: palette.fg }]}>Places</Text>
          <Text style={[type.bodySm, { color: palette.fgVariant }]}>
            {located.length.toLocaleString()} photos with a location
          </Text>
        </View>
      </View>

      {!WebView ? (
        <EmptyState icon="map" title="Update needed" hint="The map needs the latest version of the app. Install the newest build." />
      ) : located.length === 0 ? (
        <EmptyState
          icon="map-pin"
          title={indexing ? 'Finding locations…' : 'No photos with a location'}
          hint={
            indexing
              ? 'Your library is being re-scanned for location data. Check back shortly.'
              : 'Photos taken with location turned on in the camera show up here.'
          }
        />
      ) : (
        <View style={styles.mapWrap}>
          <WebView
            source={{ html }}
            originWhitelist={['*']}
            style={styles.map}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data) as { ids?: string[] };
                if (msg.ids) setSelected(msg.ids);
              } catch {
                // Ignore anything that isn't our message.
              }
            }}
          />
        </View>
      )}

      {picked.length ? (
        <View
          style={[
            styles.strip,
            { bottom: insets.bottom + 16, backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={styles.stripHead}>
            <Text style={[type.label, { color: palette.fg }]}>
              {picked.length} photo{picked.length > 1 ? 's' : ''} here
            </Text>
            <Pressable onPress={() => setSelected([])} hitSlop={10} accessibilityLabel="Close">
              <Feather name="x" size={18} color={palette.fgVariant} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 2 }}>
            {picked.slice(0, 60).map((m) => (
              <PhotoTile
                key={m.id}
                item={m}
                size={92}
                onPress={() => router.push({ pathname: '/photo/[id]', params: { id: m.id } })}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

/** Self-contained Leaflet page. Points are inlined; marker taps post the photo ids back. */
function mapHtml(points: MediaItem[], dark: boolean): string {
  const data = JSON.stringify(points.map((p) => [p.id, p.lat, p.lng]));
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<style>
  html,body,#map{margin:0;height:100%;background:${dark ? '#151413' : '#faf8f3'}}
  ${dark ? '.leaflet-tile{filter:invert(1) hue-rotate(180deg) brightness(.85) contrast(.9)}' : ''}
  .marker-cluster div{background:#9c8a6b!important;color:#fff;font:600 12px system-ui}
  .marker-cluster{background:rgba(156,138,107,.35)!important}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script>
  var pts = ${data};
  var map = L.map('map', { zoomControl: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  var send = function (ids) { window.ReactNativeWebView.postMessage(JSON.stringify({ ids: ids })); };
  var group = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
  pts.forEach(function (p) {
    var m = L.circleMarker([p[1], p[2]], { radius: 8, color: '#fff', weight: 2, fillColor: '#9c8a6b', fillOpacity: 1 });
    m._ids = [p[0]];
    m.on('click', function () { send(m._ids); });
    group.addLayer(m);
  });
  group.on('clusterclick', function (e) {
    send(e.layer.getAllChildMarkers().map(function (m) { return m._ids[0]; }));
  });
  map.addLayer(group);
  var b = group.getBounds();
  if (b.isValid()) map.fitBounds(b.pad(0.15)); else map.setView([20, 0], 2);
</script></body></html>`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  mapWrap: { flex: 1, marginHorizontal: spacing.md, marginBottom: spacing.md, borderRadius: radius.lg, overflow: 'hidden' },
  map: { flex: 1 },
  strip: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 10,
    gap: 8,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  stripHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
});
