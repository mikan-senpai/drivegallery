import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  Pressable,
  Alert,
  BackHandler,
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FilterChips, type MediaFilter } from '@/components/FilterChips';
import { PhotoTile } from '@/components/PhotoTile';
import { EmptyState } from '@/components/EmptyState';
import { GlassView } from '@/components/GlassView';
import { FastScroller, type FastScrollerHandle } from '@/components/FastScroller';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useRemoveMediaItem, useTimeline } from '@/hooks/useMedia';
import { useFolderSelection } from '@/store/folderSelection';
import { useSelection } from '@/store/selection';
import { useFavorites } from '@/store/favorites';
import { MAX_COLS, MIN_COLS, useGridPrefs } from '@/store/gridPrefs';
import { useSession } from '@/store/session';
import { AuthCancelledError, ensureWriteAccess } from '@/lib/auth';
import { trashItem } from '@/lib/drive';
import { shareMedia } from '@/lib/share';
import { saveToPhone } from '@/lib/save';
import { useIndexStatus } from '@/lib/indexSync';
import { formatBytes } from '@/lib/format';
import type { MediaItem } from '@/lib/types';
import { monthLabel, type TimelineRow } from '@/lib/grouping';

const GUTTER = 14;
/** Fixed date-header height, so scroll offsets map exactly onto rows (fast scroller). */
const DAY_H = 34;
/** Scroll distance (px) in one direction before the header reacts — avoids jitter. */
const SCROLL_THRESHOLD = 8;
/** Pinch scale past which the grid steps one column (out: bigger, in: smaller). */
const PINCH_OUT = 1.18;
const PINCH_IN = 0.85;
/** Ask before sharing more than this much data (it's downloaded first). */
const SHARE_CONFIRM_BYTES = 150 * 1024 * 1024;

type ListRow =
  | { type: 'header'; id: string; label: string; ts: number }
  | { type: 'row'; id: string; items: MediaItem[] };

export default function Timeline() {
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height: screenH } = useWindowDimensions();
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [headerH, setHeaderH] = useState(insets.top + 118);
  const demoMode = useSession((s) => s.demoMode);

  const { rows, items, isLoading, error, hasMore, loadMore, refetch } = useTimeline();
  const foldersScoped = useFolderSelection((s) => s.include.length > 0 || s.exclude.length > 0);
  const indexPhase = useIndexStatus((s) => s.phase);
  const indexedCount = useIndexStatus((s) => s.indexed);
  const errorMessage = error ? (error instanceof Error ? error.message : String(error)) : null;

  useEffect(() => {
    if (errorMessage) console.warn('[Drive] failed to load media:', errorMessage);
  }, [errorMessage]);

  // ---- Grid density (pinch to zoom) ----
  const cols = useGridPrefs((s) => s.cols);
  const stepCols = useGridPrefs((s) => s.step);
  const tileSize = (width - GUTTER * 2) / cols;
  const favorites = useFavorites((s) => s.ids);
  const listRows = useMemo(() => toListRows(rows, filter, cols, favorites), [rows, filter, cols, favorites]);


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

  /** Index of the row at the top of the visible area for a scroll offset. */
  const rowAt = useCallback(
    (offset: number): number => {
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
      return at;
    },
    [rowOffsets, headerH]
  );

  /** Month of the row at the top of the visible area for a scroll offset. */
  const labelForOffset = (offset: number): string | null => {
    for (let i = rowAt(offset); i >= 0; i--) {
      const r = listRows[i];
      if (r.type === 'header') return monthLabel(r.ts);
    }
    return null;
  };

  // Keep the photo you were looking at in place when the column count changes.
  const pendingAnchor = useRef<string | null>(null);
  const lastY = useRef(0);
  const maxScroll = useRef(0);

  const changeCols = (delta: number) => {
    const next = Math.min(MAX_COLS, Math.max(MIN_COLS, cols + delta));
    if (next === cols) return;
    for (let i = Math.max(0, rowAt(lastY.current)); i < listRows.length; i++) {
      const r = listRows[i];
      if (r.type === 'row') {
        pendingAnchor.current = r.items[0].id;
        break;
      }
    }
    Haptics.selectionAsync();
    stepCols(delta);
  };

  useEffect(() => {
    const id = pendingAnchor.current;
    if (!id) return;
    pendingAnchor.current = null;
    const idx = listRows.findIndex((r) => r.type === 'row' && r.items.some((i) => i.id === id));
    if (idx >= 0) listRef.current?.scrollToOffset({ offset: Math.max(0, rowOffsets[idx] - headerH), animated: false });
  }, [listRows, rowOffsets, headerH]);

  const pinchScale = useSharedValue(1);
  // Pinch previews the zoom (gently scaling the grid), then snaps to a new column count.
  /* eslint-disable react-hooks/refs -- gesture callbacks run on the UI thread at gesture time, not during render */
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      pinchScale.set(Math.min(1.12, Math.max(0.9, e.scale)));
    })
    .onEnd((e) => {
      if (e.scale > PINCH_OUT) runOnJS(changeCols)(-1);
      else if (e.scale < PINCH_IN) runOnJS(changeCols)(1);
    })
    .onFinalize(() => {
      pinchScale.set(withTiming(1, { duration: 180 }));
    });
  const dragSelect = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart((e) => {
      runOnJS(beginDrag)(e.x, e.y);
    })
    .onUpdate((e) => {
      runOnJS(moveDrag)(e.x, e.y);
    })
    .onFinalize(() => {
      runOnJS(endDrag)();
    });
  const gridGesture = Gesture.Simultaneous(pinch, dragSelect);
  /* eslint-enable react-hooks/refs */
  const gridStyle = useAnimatedStyle(() => ({ transform: [{ scale: pinchScale.get() }] }));

  // ---- Selection ----
  const selecting = useSelection((s) => s.active);
  const selectedIds = useSelection((s) => s.ids);
  const toggleSelection = useSelection((s) => s.toggle);
  const setSelectionIds = useSelection((s) => s.setIds);
  const clearSelection = useSelection((s) => s.clear);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const removeFromList = useRemoveMediaItem();
  const [busy, setBusy] = useState<'share' | 'save' | 'trash' | null>(null);

  const onTilePress = (item: MediaItem) => {
    if (selecting) toggleSelection(item.id);
    else router.push({ pathname: '/photo/[id]', params: { id: item.id } });
  };

  // ---- Drag to select: long-press a tile, then drag across others to select the range ----
  /** Timeline items in display order + each one's position, for range selection. */
  const order = useMemo(() => {
    const list: MediaItem[] = [];
    for (const r of listRows) if (r.type === 'row') list.push(...r.items);
    return { list, pos: new Map(list.map((m, i) => [m.id, i])) };
  }, [listRows]);

  /** Item ids of each day, keyed by the day's header row id ("tap a date to select the day"). */
  const dayItems = useMemo(() => {
    const map = new Map<string, string[]>();
    let current: string[] | null = null;
    for (const r of listRows) {
      if (r.type === 'header') {
        current = [];
        map.set(r.id, current);
      } else if (current) {
        current.push(...r.items.map((i) => i.id));
      }
    }
    return map;
  }, [listRows]);

  /** The tile under a point in the grid's own coordinates (null over gaps and date headers). */
  const itemAt = (x: number, y: number): MediaItem | null => {
    const contentY = y + lastY.current;
    let lo = 0;
    let hi = rowOffsets.length - 1;
    let at = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rowOffsets[mid] <= contentY) {
        at = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    const row = listRows[at];
    if (!row || row.type !== 'row') return null;
    const col = Math.min(cols - 1, Math.max(0, Math.floor((x - GUTTER) / tileSize)));
    return row.items[Math.min(col, row.items.length - 1)] ?? null;
  };

  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ anchor: number; base: string[]; x: number; y: number } | null>(null);
  const autoScroll = useRef<{ timer: ReturnType<typeof setInterval>; dir: number } | null>(null);

  /** Selection = what was selected before the drag + everything between the anchor and the finger. */
  const applyDrag = () => {
    const d = drag.current;
    if (!d) return;
    const item = itemAt(d.x, d.y);
    const at = item ? order.pos.get(item.id) : undefined;
    if (at === undefined) return;
    const [from, to] = at < d.anchor ? [at, d.anchor] : [d.anchor, at];
    const range = order.list.slice(from, to + 1).map((i) => i.id);
    setSelectionIds([...new Set([...d.base, ...range])]);
  };

  const stopAutoScroll = () => {
    if (autoScroll.current) clearInterval(autoScroll.current.timer);
    autoScroll.current = null;
  };

  const beginDrag = (x: number, y: number) => {
    const item = itemAt(x, y);
    const anchor = item ? order.pos.get(item.id) : undefined;
    if (anchor === undefined) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const sel = useSelection.getState();
    drag.current = { anchor, base: sel.active ? sel.ids : [], x, y };
    setDragging(true);
    applyDrag();
  };

  const moveDrag = (x: number, y: number) => {
    const d = drag.current;
    if (!d) return;
    d.x = x;
    d.y = y;
    applyDrag();

    // Holding near the top/bottom edge scrolls, and keeps extending the selection.
    const dir = y < headerH + 24 ? -1 : y > screenH - (insets.bottom + 120) ? 1 : 0;
    if (dir === autoScroll.current?.dir) return;
    stopAutoScroll();
    if (dir === 0) return;
    autoScroll.current = {
      dir,
      timer: setInterval(() => {
        const next = Math.min(maxScroll.current, Math.max(0, lastY.current + dir * 22));
        if (next === lastY.current) return;
        lastY.current = next; // keep hit-testing in step before onScroll reports back
        listRef.current?.scrollToOffset({ offset: next, animated: false });
        applyDrag();
      }, 16),
    };
  };

  const endDrag = () => {
    drag.current = null;
    stopAutoScroll();
    setDragging(false);
  };

  /** While selecting, tapping a date header selects (or clears) that whole day. */
  const toggleDay = (headerId: string) => {
    const ids = dayItems.get(headerId) ?? [];
    if (!ids.length) return;
    Haptics.selectionAsync();
    const current = useSelection.getState().ids;
    const all = ids.every((id) => current.includes(id));
    const dayIds = new Set(ids);
    setSelectionIds(all ? current.filter((id) => !dayIds.has(id)) : [...new Set([...current, ...ids])]);
  };

  // Android back leaves selection mode; leaving the screen clears it.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!useSelection.getState().active) return false;
        useSelection.getState().clear();
        return true;
      });
      return () => {
        sub.remove();
        useSelection.getState().clear();
      };
    }, [])
  );

  const selectedItems = () => items.filter((i) => selectedSet.has(i.id));

  const saveSelected = async () => {
    const picked = selectedItems();
    if (!picked.length || busy) return;
    setBusy('save');
    try {
      const n = await saveToPhone(picked, { demo: demoMode });
      clearSelection();
      Alert.alert('Saved', `Saved ${n} item${n > 1 ? 's' : ''} to your phone's gallery.`);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const shareSelected = async () => {
    const picked = selectedItems();
    if (!picked.length || busy) return;
    const total = picked.reduce((sum, i) => sum + (i.sizeBytes ?? 0), 0);
    const go = async () => {
      setBusy('share');
      try {
        await shareMedia(picked, { demo: demoMode });
        clearSelection();
      } catch (e) {
        Alert.alert('Could not share', e instanceof Error ? e.message : 'Try again.');
      } finally {
        setBusy(null);
      }
    };
    if (total > SHARE_CONFIRM_BYTES) {
      Alert.alert('Large download', `Sharing these ${picked.length} items downloads ${formatBytes(total)} first.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share', onPress: () => void go() },
      ]);
    } else {
      await go();
    }
  };

  const trashSelected = () => {
    const picked = selectedItems();
    if (!picked.length || busy) return;
    const n = picked.length;
    Alert.alert(
      `Move ${n} item${n > 1 ? 's' : ''} to Trash?`,
      'They go to your Google Drive Trash. You can restore them from Drive for 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Trash',
          style: 'destructive',
          onPress: async () => {
            if (demoMode) {
              removeFromList(picked.map((i) => i.id));
              clearSelection();
              return;
            }
            setBusy('trash');
            try {
              // First delete asks Google for edit access; sign-in itself stays read-only.
              if (!(await ensureWriteAccess())) return;
              const results = await Promise.allSettled(picked.map((i) => trashItem(i.id)));
              const done = picked.filter((_, i) => results[i].status === 'fulfilled').map((i) => i.id);
              removeFromList(done);
              clearSelection();
              const failed = n - done.length;
              if (failed) Alert.alert('Some items were not moved', `${failed} of ${n} couldn't be moved to Trash. Try again.`);
            } catch (e) {
              if (!(e instanceof AuthCancelledError)) {
                Alert.alert('Could not move to Trash', e instanceof Error ? e.message : 'Try again.');
              }
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  // ---- Auto-hiding header: hide on scroll down, reveal on scroll up ----
  const shown = useSharedValue(1);
  const shownRef = useRef(1);

  useEffect(() => {
    // Selection controls live in the header, so keep it on screen while selecting.
    if (selecting && shownRef.current !== 1) {
      shownRef.current = 1;
      shown.set(withTiming(1, { duration: 200 }));
    }
  }, [selecting, shown]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    maxScroll.current = Math.max(0, contentSize.height - layoutMeasurement.height);
    scrollerRef.current?.update(contentOffset.y, contentSize.height, layoutMeasurement.height);
    const y = contentOffset.y;
    const dy = y - lastY.current;
    lastY.current = y;
    if (selecting) return;

    let target = shownRef.current;
    if (y < 12) target = 1;
    else if (dy > SCROLL_THRESHOLD) target = 0;
    else if (dy < -SCROLL_THRESHOLD) target = 1;

    if (target !== shownRef.current) {
      shownRef.current = target;
      shown.set(withTiming(target, { duration: 240 }));
    }
  };

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(shown.get(), [0, 1], [-(headerH + 12), 0]) }],
    opacity: shown.get(),
  }));

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <GestureDetector gesture={gridGesture}>
        <Animated.View style={[styles.list, gridStyle]}>
          <FlashList
            ref={listRef}
            data={listRows}
            style={styles.list}
            keyExtractor={(r) => r.id}
            getItemType={(r) => r.type}
            extraData={selectedSet}
            // Dragging to select owns the finger; edge auto-scroll still moves the list.
            scrollEnabled={!dragging}
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
                <EmptyState
                  icon="loader"
                  title="Indexing your Drive…"
                  hint="The first time takes a moment. After this, your photos open instantly."
                />
              ) : errorMessage ? (
                <EmptyState icon="alert-circle" title="Couldn't load your Drive" hint={`${errorMessage}\n\nPull down to retry.`} />
              ) : (
                <EmptyState icon="image" title="No photos found" hint="No images or videos in this Drive yet. Pull down to refresh." />
              )
            }
            renderItem={({ item: row }) =>
              row.type === 'header' ? (
                <Pressable
                  style={styles.dayRow}
                  disabled={!selecting}
                  onPress={() => toggleDay(row.id)}
                  accessibilityLabel={selecting ? `Select all from ${row.label}` : undefined}
                >
                  {selecting ? (
                    <DayCheck checked={(dayItems.get(row.id) ?? []).every((id) => selectedSet.has(id))} />
                  ) : null}
                  <Text style={[type.uppercase, styles.day, { color: palette.fgVariant }]}>{row.label}</Text>
                </Pressable>
              ) : (
                <View style={styles.gridRow}>
                  {row.items.map((m) => (
                    <PhotoTile
                      key={m.id}
                      item={m}
                      size={tileSize}
                      onPress={onTilePress}
                      selecting={selecting}
                      selected={selectedSet.has(m.id)}
                    />
                  ))}
                  {padCells(row.items.length, cols).map((k) => (
                    <View key={k} style={{ width: tileSize, height: tileSize }} />
                  ))}
                </View>
              )
            }
          />
        </Animated.View>
      </GestureDetector>

      {/* Status-bar scrim — keeps the clock legible while the header is hidden. */}
      <LinearGradient
        colors={[palette.bg, palette.bg + '00']}
        style={[styles.topScrim, { height: insets.top + 18 }]}
        pointerEvents="none"
      />

      {/* Auto-hiding header: title, chips and actions — or selection controls while selecting. */}
      <Animated.View
        style={[styles.headerWrap, headerStyle]}
        pointerEvents="box-none"
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
      >
        {/* Solid behind the controls so list content never shows through them. */}
        <View style={{ paddingTop: insets.top + spacing.xs, paddingBottom: spacing.xs, backgroundColor: palette.bg }}>
          {selecting ? (
            <View style={styles.selectBar}>
              <Pressable onPress={clearSelection} hitSlop={10} accessibilityLabel="Cancel selection">
                <Feather name="x" size={24} color={palette.fg} />
              </Pressable>
              <Text style={[type.headlineLg, { color: palette.fg }]}>
                {selectedIds.length} selected
              </Text>
            </View>
          ) : (
            <ScreenHeader
              title="Photos"
              subtitle={
                indexPhase === 'full'
                  ? `Indexing your Drive · ${indexedCount.toLocaleString()} found`
                  : `${items.length.toLocaleString()} in Drive`
              }
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
          )}
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

      {/* Selection actions take the tab bar's place while selecting. */}
      {selecting ? (
        <View style={[styles.actionWrap, { bottom: insets.bottom + 18 }]}>
          <View style={[styles.actionBar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <ActionButton
              icon="share"
              label={busy === 'share' ? 'Preparing…' : 'Share'}
              busy={busy === 'share'}
              onPress={shareSelected}
            />
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            <ActionButton
              icon="download"
              label={busy === 'save' ? 'Saving…' : 'Save'}
              busy={busy === 'save'}
              onPress={saveSelected}
            />
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            <ActionButton
              icon="trash-2"
              label={busy === 'trash' ? 'Moving…' : 'Trash'}
              busy={busy === 'trash'}
              onPress={trashSelected}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Check circle on a date header while selecting: filled when the whole day is selected. */
function DayCheck({ checked }: { checked: boolean }) {
  const { palette } = useTheme();
  return (
    <View
      style={[
        styles.dayCheck,
        checked ? { backgroundColor: palette.primary, borderColor: palette.primary } : { borderColor: palette.fgVariant },
      ]}
    >
      {checked ? <Feather name="check" size={11} color={palette.onPrimary} /> : null}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  busy,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  busy?: boolean;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={busy} style={styles.action} hitSlop={6}>
      {busy ? <ActivityIndicator size="small" color={palette.fg} /> : <Feather name={icon} size={20} color={palette.fg} />}
      <Text style={[type.label, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

function toListRows(
  rows: TimelineRow[],
  filter: MediaFilter,
  cols: number,
  favorites: Record<string, true>
): ListRow[] {
  const out: ListRow[] = [];
  let bucket: MediaItem[] = [];
  let headerId = '';

  const flush = () => {
    for (let i = 0; i < bucket.length; i += cols) {
      out.push({ type: 'row', id: `${headerId}-c${cols}-r${i}`, items: bucket.slice(i, i + cols) });
    }
    bucket = [];
  };

  for (const row of rows) {
    if (row.type === 'header') {
      flush();
      headerId = row.id;
      out.push({ type: 'header', id: row.id, label: row.label, ts: row.ts });
    } else if (matches(row.item, filter, favorites)) {
      bucket.push(row.item);
    }
  }
  flush();
  return out.filter((r, i) => !(r.type === 'header' && (out[i + 1]?.type ?? 'header') === 'header'));
}

function matches(item: MediaItem, filter: MediaFilter, favorites: Record<string, true>): boolean {
  switch (filter) {
    case 'photos':
      return item.kind === 'photo';
    case 'videos':
      return item.kind === 'video';
    case 'favorites':
      return Boolean(favorites[item.id]);
    default:
      return true;
  }
}

const padCells = (n: number, cols: number): string[] =>
  Array.from({ length: (cols - (n % cols)) % cols }, (_, i) => `pad-${i}`);

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
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    minHeight: 64,
  },
  dayRow: { height: DAY_H, flexDirection: 'row', alignItems: 'center', gap: 2 },
  dayCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: { marginHorizontal: 6 },
  gridRow: { flexDirection: 'row' },
  actionWrap: { position: 'absolute', left: 22, right: 22 },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  divider: { width: StyleSheet.hairlineWidth, height: 28 },
});
