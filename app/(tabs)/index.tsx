import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
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

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <ScreenHeader title="Photos" subtitle={`${items.length.toLocaleString()} in Drive`} />
      <FilterChips value={filter} onChange={setFilter} />

      <FlashList
        data={listRows}
        style={styles.list}
        keyExtractor={(r) => r.id}
        getItemType={(r) => r.type}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={palette.fgVariant} />}
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
  // Drop headers that ended up with no items after filtering.
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
  day: { marginHorizontal: 6, marginTop: spacing.sm, marginBottom: spacing.sm },
  gridRow: { flexDirection: 'row' },
});
