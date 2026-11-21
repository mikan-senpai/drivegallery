import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, RefreshControl, Pressable } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FilterChips, type MediaFilter } from '@/components/FilterChips';
import { PhotoTile } from '@/components/PhotoTile';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, type } from '@/theme/tokens';
import { useTimeline } from '@/hooks/useMedia';
import type { MediaItem } from '@/lib/types';
import type { TimelineRow } from '@/lib/grouping';

const COLS = 3;
const GUTTER = 14;

type ListRow = { type: 'header'; id: string; label: string } | { type: 'row'; id: string; items: MediaItem[] };

export default function Timeline() {
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<MediaFilter>('all');

  const { rows, items, isLoading, hasMore, loadMore, refetch } = useTimeline();
  const tileSize = (width - GUTTER * 2) / COLS;

  const listRows = useMemo(() => toListRows(rows, filter), [rows, filter]);
  const open = (item: MediaItem) => router.push({ pathname: '/photo/[id]', params: { id: item.id } });

  // Title + chips live in the list header, so they scroll away and return at the top.
  const ListHeader = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
      <ScreenHeader
        title="Photos"
        subtitle={`${items.length.toLocaleString()} in Drive`}
        right={
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            style={[styles.gear, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Feather name="settings" size={16} color={palette.fg} />
          </Pressable>
        }
      />
      <FilterChips value={filter} onChange={setFilter} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <FlashList
        data={listRows}
        style={styles.list}
        keyExtractor={(r) => r.id}
        getItemType={(r) => r.type}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={palette.fgVariant} progressViewOffset={insets.top} />}
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

      {/* Fixed status-bar scrim: keeps the clock/battery legible as photos scroll under. */}
      <LinearGradient
        colors={[palette.bg, palette.bg + '00']}
        style={[styles.topScrim, { height: insets.top + 18 }]}
        pointerEvents="none"
      />

      {/* Fade the grid out behind the floating tab bar. */}
      <LinearGradient
        colors={['transparent', palette.bg]}
        style={[styles.bottomFade, { height: insets.bottom + 80 }]}
        pointerEvents="none"
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
  // Cancel the list's horizontal gutter so the header uses its own padding.
  header: { marginHorizontal: -GUTTER },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  gear: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  day: { marginHorizontal: 6, marginTop: spacing.sm, marginBottom: spacing.sm },
  gridRow: { flexDirection: 'row' },
});
