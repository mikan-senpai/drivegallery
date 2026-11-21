/**
 * Search the whole indexed library.
 *
 * Typed words match filename, folder name, camera and the month/year a photo
 * was taken ("goa 2024", "november", "pixel"); every word must match. Chips
 * filter by type, year (built from years you actually have) and camera.
 * Filters work with nothing typed, e.g. "all videos from 2023".
 */
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { PhotoTile } from '@/components/PhotoTile';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useFolderIndex, useMediaItems } from '@/hooks/useMedia';
import type { MediaItem } from '@/lib/types';

const COLS = 3;
const GUTTER = 14;
const TOP_CAMERAS = 6;

type Kind = 'all' | 'photo' | 'video';

export default function Search() {
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { items } = useMediaItems();
  const { data: folderIndex } = useFolderIndex();

  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [year, setYear] = useState<number | null>(null);
  const [camera, setCamera] = useState<string | null>(null);

  // One lowercase haystack per item: name, folder, camera, month name, year.
  const haystack = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items) {
      const d = new Date(i.takenAt);
      const folder = i.parents?.[0] ? (folderIndex?.byId.get(i.parents[0])?.name ?? '') : '';
      map.set(
        i.id,
        [i.name, folder, i.camera ?? '', d.toLocaleDateString(undefined, { month: 'long' }), String(d.getFullYear())]
          .join(' ')
          .toLowerCase()
      );
    }
    return map;
  }, [items, folderIndex]);

  const years = useMemo(
    () => [...new Set(items.map((i) => new Date(i.takenAt).getFullYear()))].filter((y) => y > 1990).sort((a, b) => b - a),
    [items]
  );
  const cameras = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) if (i.camera) counts.set(i.camera, (counts.get(i.camera) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_CAMERAS).map(([c]) => c);
  }, [items]);

  const active = q.trim() !== '' || kind !== 'all' || year !== null || camera !== null;
  const results = useMemo(() => {
    if (!active) return [];
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((i) => {
      if (kind !== 'all' && i.kind !== kind) return false;
      if (year !== null && new Date(i.takenAt).getFullYear() !== year) return false;
      if (camera !== null && i.camera !== camera) return false;
      const text = haystack.get(i.id) ?? '';
      return words.every((w) => text.includes(w));
    });
  }, [active, q, kind, year, camera, items, haystack]);

  const tileSize = (width - GUTTER * 2) / COLS;
  const rows = useMemo(() => chunk(results, COLS), [results]);
  const open = (item: MediaItem) => router.push({ pathname: '/photo/[id]', params: { id: item.id } });
  const clearAll = () => {
    setQ('');
    setKind('all');
    setYear(null);
    setCamera(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <ScreenHeader title="Search" subtitle={active ? `${results.length.toLocaleString()} found` : undefined} />
      <View style={[styles.field, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Feather name="search" size={18} color={palette.fgVariant} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Name, folder, month, year or camera"
          placeholderTextColor={palette.fgVariant}
          style={[type.bodySm, styles.input, { color: palette.fg }]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {active ? (
          <Pressable onPress={clearAll} hitSlop={10} accessibilityLabel="Clear search">
            <Feather name="x" size={18} color={palette.fgVariant} />
          </Pressable>
        ) : null}
      </View>

      <ChipRow>
        {(['all', 'photo', 'video'] as const).map((k) => (
          <Chip key={k} label={k === 'all' ? 'All' : k === 'photo' ? 'Photos' : 'Videos'} on={kind === k} onPress={() => setKind(k)} />
        ))}
        {years.map((y) => (
          <Chip key={y} label={String(y)} on={year === y} onPress={() => setYear(year === y ? null : y)} />
        ))}
      </ChipRow>
      {cameras.length ? (
        <ChipRow>
          {cameras.map((c) => (
            <Chip key={c} icon="camera" label={c} on={camera === c} onPress={() => setCamera(camera === c ? null : c)} />
          ))}
        </ChipRow>
      ) : null}

      {!active ? (
        <EmptyState
          icon="search"
          title="Find a photo"
          hint={'Try "beach", "november 2023" or a folder name,\nor tap a year or camera above.'}
        />
      ) : (
        <FlashList
          data={rows}
          style={{ flex: 1 }}
          keyExtractor={(row) => row[0].id}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 110 }}
          ListEmptyComponent={<EmptyState icon="image" title="No matches" hint="Try fewer words or clear a filter." />}
          renderItem={({ item: row }) => (
            <View style={{ flexDirection: 'row' }}>
              {row.map((m) => (
                <PhotoTile key={m.id} item={m} size={tileSize} onPress={open} />
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroll}
      contentContainerStyle={styles.chipRow}
    >
      {children}
    </ScrollView>
  );
}

function Chip({
  label,
  on,
  onPress,
  icon,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: on ? palette.primary : 'transparent', borderColor: on ? 'transparent' : palette.border },
      ]}
    >
      {icon ? <Feather name={icon} size={12} color={on ? palette.onPrimary : palette.fgVariant} /> : null}
      <Text style={[type.label, { color: on ? palette.onPrimary : palette.fgVariant }]}>{label}</Text>
    </Pressable>
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, padding: 0 },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: { gap: 7, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
