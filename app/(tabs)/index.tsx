import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { FlashList, type FlashListRef } from '@shopify/flash-list';
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
import { FastScroller, type FastScrollerHandle } from '@/components/FastScroller';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, type } from '@/theme/tokens';
import { useTimeline } from '@/hooks/useMedia';
import { useFolderSelection } from '@/store/folderSelection';
import type { MediaItem } from '@/lib/types';
import { monthLabel, type TimelineRow } from '@/lib/grouping';

const COLS = 3;
const GUTTER = 14;
/** Fixed date-header height, so scroll offsets map exactly onto rows (fast scroller). */
const DAY_H = 34;
/** Scroll distance (px) in one direction before the header reacts — avoids jitter. */
const SCROLL_THRESHOLD = 8;

type ListRow =
  | { type: 'header'; id: string; label: string; ts: number }
  | { type: 'row'; id: string; items: MediaItem[] };

export default function Timeline() {
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [headerH, setHeaderH] = useState(insets.top + 118);

  const { rows, items, isLoading, error, hasMore, loadMore, refetch } = useTimeline();
  const foldersScoped = useFolderSelection((s) => s.include.length > 0 || s.exclude.length > 0);
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;

  useEffect(() => {
    if (errorMessage) console.warn('[Drive] failed to load media:', errorMessage);
  }, [errorMessage]);
  const tileSize = (width - GUTTER * 2) / COLS;
  const listRows = useMemo(() => toListRows(rows, filter), [rows, filter]);
  const open = (item: MediaItem) => router.push({ pathname: '/photo/[id]', params: { id: item.id } });

  const listRef = useRef<FlashListRef<ListRow>>(null);
  const scrollerRef = useRef<FastScrollerHandle>(null);

  // Start offset of every row. Row heights are fixed (DAY_H / tileSize), so this is exact.
  const rowOffsets = useMemo(() => {
    const offsets: number[] = new Array(listRows.length);
    let y = headerH;
    for (let i = 0; i < listRows.length; i++) {
      offsets[i] = y;
      y += listRows[i].type === 'header' ? DAY_H : tileSize;
    }
    return offsets;
  }, [listRows, headerH, tileSize]);

  /** Month of the row at the top of the visible area for a scroll offset. */
  const labelForOffset = (offset: number): string | null => {
    const target = offset + headerH;
    let lo = 0;
    let hi = rowOffsets.length - 1;
    let at = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rowOffsets[mid] <= target) {
        at = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    for (let i = at; i >= 0; i--) {
      const r = listRows[i];
      if (r.type === 'header') return monthLabel(r.ts);
    }
    return null;
  };

  // Header visibility: 1 = shown, 0 = hidden. Hide on scroll down, reveal on scroll up.
  const shown = useSharedValue(1);
  const lastY = useRef(0);
  const shownRef = useRef(1);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    scrollerRef.current?.update(contentOffset.y, contentSize.height, layoutMeasurement.height);
    const y = contentOffset.y;
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
        ref={listRef}
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
          isLoading ? (
            <EmptyState icon="loader" title="Loading your Drive…" />
          ) : errorMessage ? (
            <EmptyState icon="alert-circle" title="Couldn't load your Drive" hint={`${errorMessage}\n\nPull down to retry.`} />
          ) : (
            <EmptyState icon="image" title="No photos found" hint="No images or videos in this Drive yet. Pull down to refresh." />
          )
        }
        renderItem={({ item: row }) =>
          row.type === 'header' ? (
            <View style={styles.dayRow}>
              <Text style={[type.uppercase, styles.day, { color: palette.fgVariant }]}>{row.label}</Text>
            </View>
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
        {/* Solid behind title + chips so list content never shows through the controls. */}
        <View style={{ paddingTop: insets.top + spacing.xs, paddingBottom: spacing.xs, backgroundColor: palette.bg }}>
          <ScreenHeader
            title="Photos"
            subtitle={`${items.length.toLocaleString()} in Drive`}
            right={
              <View style={styles.headerActions}>
                {/* Folder filter — a dot marks that only some folders are shown. */}
                <Pressable onPress={() => router.push('/folders')} hitSlop={8} accessibilityLabel="Choose folders">
                  <GlassView radius={19} style={styles.gear}>
                    <View style={styles.gearInner}>
                      <Feather name="folder" size={17} color={palette.fg} />
                    </View>
                  </GlassView>
                  {foldersScoped ? <View style={[styles.dot, { backgroundColor: palette.primary }]} /> : null}
                </Pressable>
                <Pressable onPress={() => router.push('/settings')} hitSlop={8} accessibilityLabel="Settings">
                  <GlassView radius={19} style={styles.gear}>
                    <View style={styles.gearInner}>
                      <Feather name="settings" size={17} color={palette.fg} />
                    </View>
                  </GlassView>
                </Pressable>
              </View>
            }
          />
          <FilterChips value={filter} onChange={setFilter} />
        </View>
        {/* The fade lives below the controls: photos dissolve into the header here. */}
        <LinearGradient colors={[palette.bg, palette.bg + '00']} style={styles.headerFade} pointerEvents="none" />
      </Animated.View>

      {/* Samsung-style fast scroller: drag the handle to fly through the timeline. */}
      <FastScroller
        ref={scrollerRef}
        top={headerH + 4}
        bottom={insets.bottom + 100}
        onSeek={(offset) => listRef.current?.scrollToOffset({ offset, animated: false })}
        labelForOffset={labelForOffset}
      />
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
      out.push({ type: 'header', id: row.id, label: row.label, ts: row.ts });
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
  headerFade: { height: 26 },
  gear: { width: 38, height: 38 },
  headerActions: { flexDirection: 'row', gap: 10 },
  dot: { position: 'absolute', top: 1, right: 1, width: 9, height: 9, borderRadius: 5 },
  gearInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dayRow: { height: DAY_H, justifyContent: 'center' },
  day: { marginHorizontal: 6 },
  gridRow: { flexDirection: 'row' },
});
