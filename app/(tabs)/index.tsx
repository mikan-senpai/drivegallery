import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  Pressable,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FilterChips, type MediaFilter } from '@/components/FilterChips';
import { PhotoTile } from '@/components/PhotoTile';
import { EmptyState } from '@/components/EmptyState';
import { GlassView } from '@/components/GlassView';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, type } from '@/theme/tokens';
import { useTimeline } from '@/hooks/useMedia';
import type { MediaItem } from '@/lib/types';
import type { TimelineRow } from '@/lib/grouping';

const COLS = 3;
const GUTTER = 14;
/** Scroll distance (px) in one direction before the header reacts — avoids jitter. */
const SCROLL_THRESHOLD = 8;

type ListRow = { type: 'header'; id: string; label: string } | { type: 'row'; id: string; items: MediaItem[] };

export default function Timeline() {
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [headerH, setHeaderH] = useState(insets.top + 118);

  const { rows, items, isLoading, hasMore, loadMore, refetch } = useTimeline();
  const tileSize = (width - GUTTER * 2) / COLS;
  const listRows = useMemo(() => toListRows(rows, filter), [rows, filter]);
  const open = (item: MediaItem) => router.push({ pathname: '/photo/[id]', params: { id: item.id } });

  // Header visibility: 1 = shown, 0 = hidden. Hide on scroll down, reveal on scroll up.
  const shown = useSharedValue(1);
  const lastY = useRef(0);
  const shownRef = useRef(1);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    lastY.current = y;

    let target = shownRef.current;
    if (y < 12) target = 1;
    else if (dy > SCROLL_THRESHOLD) target = 0;
    else if (dy < -SCROLL_THRESHOLD) target = 1;

    if (target !== shownRef.current) {
      shownRef.current = target;
      shown.value = withTiming(target, { duration: 240 });
    }
  };

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(shown.value, [0, 1], [-(headerH + 12), 0]) }],
    opacity: shown.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <FlashList
        data={listRows}
        style={styles.list}
        keyExtractor={(r) => r.id}
        getItemType={(r) => r.type}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerH, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 110 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={palette.fgVariant} progressViewOffset={headerH} />
        }
        onEndReachedThreshold={0.6}
        onEndReached={() => hasMore && loadMore()}
        ListEmptyComponent={
          isLoading ? null : <EmptyState icon="image" title="No photos yet" hint="Pull to refresh once your Drive is indexed." />
        }
        renderItem={({ item: row }) =>
          row.type === 'header' ? (
            <Text style={[type.uppercase, styles.day, { color: palette.fgVariant }]}>{row.label}</Text>
          ) : (
            <View style={styles.gridRow}>
              {row.items.map((m) => (
                <PhotoTile key={m.id} item={m} size={tileSize} onPress={open} />
              ))}
              {padCells(row.items.length).map((k) => (
                <View key={k} style={{ width: tileSize, height: tileSize }} />
              ))}
            </View>
          )
        }
      />

      {/* Fade the grid out behind the floating tab bar. */}
      <LinearGradient
        colors={['transparent', palette.bg]}
        style={[styles.bottomFade, { height: insets.bottom + 80 }]}
        pointerEvents="none"
      />

      {/* Status-bar scrim — keeps the clock legible while the header is hidden. */}
      <LinearGradient
        colors={[palette.bg, palette.bg + '00']}
        style={[styles.topScrim, { height: insets.top + 18 }]}
        pointerEvents="none"
      />

      {/* Auto-hiding header: gradient fade behind title, chips and a glass gear. */}
      <Animated.View
        style={[styles.headerWrap, headerStyle]}
        pointerEvents="box-none"
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
      >
        <LinearGradient
          colors={[palette.bg, palette.bg, palette.bg + '00']}
          locations={[0, 0.62, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={{ paddingTop: insets.top + spacing.xs, paddingBottom: spacing.sm }}>
          <ScreenHeader
            title="Photos"
            subtitle={`${items.length.toLocaleString()} in Drive`}
            right={
              <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
                <GlassView radius={19} style={styles.gear}>
                  <View style={styles.gearInner}>
                    <Feather name="settings" size={17} color={palette.fg} />
                  </View>
                </GlassView>
              </Pressable>
            }
          />
          <FilterChips value={filter} onChange={setFilter} />
        </View>
      </Animated.View>
    </View>
  );
}

function toListRows(rows: TimelineRow[], filter: MediaFilter): ListRow[] {
  const out: ListRow[] = [];
  let bucket: MediaItem[] = [];
  let headerId = '';

  const flush = () => {
    for (let i = 0; i < bucket.length; i += COLS) {
      out.push({ type: 'row', id: `${headerId}-r${i}`, items: bucket.slice(i, i + COLS) });
    }
    bucket = [];
  };

  for (const row of rows) {
    if (row.type === 'header') {
      flush();
      headerId = row.id;
      out.push({ type: 'header', id: row.id, label: row.label });
    } else if (matches(row.item, filter)) {
      bucket.push(row.item);
    }
  }
  flush();
  return out.filter((r, i) => !(r.type === 'header' && (out[i + 1]?.type ?? 'header') === 'header'));
}

function matches(item: MediaItem, filter: MediaFilter): boolean {
  switch (filter) {
    case 'photos':
      return item.kind === 'photo';
    case 'videos':
      return item.kind === 'video';
    case 'favorites':
      return Boolean(item.favorite);
    default:
      return true;
  }
}

const padCells = (n: number): string[] =>
  Array.from({ length: (COLS - (n % COLS)) % COLS }, (_, i) => `pad-${i}`);

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  gear: { width: 38, height: 38 },
  gearInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  day: { marginHorizontal: 6, marginTop: spacing.sm, marginBottom: spacing.sm },
  gridRow: { flexDirection: 'row' },
});
