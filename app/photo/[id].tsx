import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, FlatList, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ZoomableImage } from '@/components/ZoomableImage';
import { DriveVideo } from '@/components/DriveVideo';
import { useMediaItems, useRemoveMediaItem } from '@/hooks/useMedia';
import { getFolderPath, mediaUrl, trashItem } from '@/lib/drive';
import { AuthCancelledError, ensureWriteAccess } from '@/lib/auth';
import { useSession } from '@/store/session';
import { formatBytes, formatDate, formatDuration } from '@/lib/format';
import { useAuthHeaders } from '@/lib/tokenStore';
import { type as typeTokens } from '@/theme/tokens';
import type { MediaItem } from '@/lib/types';

export default function Viewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const demoMode = useSession((s) => s.demoMode);
  const { items } = useMediaItems();
  const { width, height } = useWindowDimensions();
  const headers = useAuthHeaders();
  const listRef = useRef<FlatList<MediaItem>>(null);

  const initialIndex = useMemo(() => Math.max(0, items.findIndex((i) => i.id === id)), [items, id]);
  const [index, setIndex] = useState(initialIndex);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  // Measured heights of the top bar and bottom action row; videos fit between them.
  const [chromeTop, setChromeTop] = useState(0);
  const [chromeBottom, setChromeBottom] = useState(0);
  const current = items[index];
  const removeFromList = useRemoveMediaItem();

  const onRemove = () => {
    if (!current) return;
    Alert.alert('Move to Trash', 'This moves the item to your Google Drive Trash. You can restore it from Drive for 30 days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to Trash',
        style: 'destructive',
        onPress: async () => {
          if (demoMode) {
            removeFromList(current.id);
            return router.back();
          }
          try {
            // First delete asks Google for edit access; sign-in itself stays read-only.
            const granted = await ensureWriteAccess();
            if (!granted) return;
            await trashItem(current.id);
            removeFromList(current.id);
            router.back();
          } catch (e) {
            if (e instanceof AuthCancelledError) return;
            Alert.alert('Could not move to Trash', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const info = async () => {
    if (!current) return;
    const location = demoMode ? 'Demo photos' : await getFolderPath(current.parents).catch(() => 'Unknown folder');
    Alert.alert(
      current.name,
      [
        `${current.kind === 'video' ? 'Video' : 'Photo'} · ${formatDate(current.takenAt)}`,
        [
          formatBytes(current.sizeBytes),
          current.width && current.height ? `${current.width} × ${current.height}` : null,
          current.durationMs ? formatDuration(current.durationMs) : null,
        ]
          .filter(Boolean)
          .join('  ·  '),
        `📁 ${location}`,
      ].join('\n')
    );
  };

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={items}
        horizontal
        pagingEnabled
        initialScrollIndex={initialIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        scrollEnabled={scrollEnabled}
        // Re-render pages when the active page changes (stops videos you swipe away from).
        extraData={`${index}-${chromeTop}-${chromeBottom}`}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
            {item.kind === 'video' && !demoMode ? (
              <DriveVideo
                uri={mediaUrl(item.id)}
                headers={headers}
                poster={item.previewUrl ? { uri: item.previewUrl, headers, cacheKey: `${item.id}-full` } : undefined}
                width={width}
                height={height}
                active={i === index}
                chromeTop={chromeTop}
                chromeBottom={chromeBottom}
              />
            ) : (
            <ZoomableImage
              source={{
                uri: item.previewUrl ?? item.thumbnailUrl,
                headers,
                cacheKey: `${item.id}-full`,
              }}
              placeholder={item.thumbnailUrl ? { uri: item.thumbnailUrl, headers, cacheKey: `${item.id}-grid` } : undefined}
              width={width}
              height={height}
              onZoomChange={(z) => setScrollEnabled(!z)}
            />
            )}
          </View>
        )}
      />

      <SafeAreaView
        style={styles.top}
        pointerEvents="box-none"
        onLayout={(e) => setChromeTop(e.nativeEvent.layout.height)}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color="#fff" />
        </Pressable>
        <View style={styles.chip}>
          <Feather name="cloud" size={12} color="#fff" />
          <Text style={styles.chipText}>
            In Drive · {formatBytes(current?.sizeBytes)} · {index + 1}/{items.length}
          </Text>
        </View>
        <Feather name="more-vertical" size={22} color="#fff" />
      </SafeAreaView>

      <SafeAreaView
        style={styles.bottom}
        pointerEvents="box-none"
        onLayout={(e) => setChromeBottom(e.nativeEvent.layout.height)}
      >
        <Action icon="share" label="Share" onPress={() => Alert.alert('Share', 'Native share sheet (stub).')} />
        <Action icon="heart" label="Favorite" onPress={() => Alert.alert('Favorite', 'Toggled (stub).')} />
        <Action icon="info" label="Info" onPress={info} />
        <Action icon="trash-2" label="Remove" onPress={onRemove} />
      </SafeAreaView>
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.action} hitSlop={8}>
      <Feather name={icon} size={20} color="#fff" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  chipText: { ...typeTokens.uppercase, color: '#fff' },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  action: { alignItems: 'center', gap: 5 },
  actionLabel: { color: '#fff', fontSize: 10, fontFamily: 'Outfit_300Light' },
});
