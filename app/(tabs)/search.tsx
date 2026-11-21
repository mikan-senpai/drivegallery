import React, { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { PhotoTile } from '@/components/PhotoTile';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useMediaItems } from '@/hooks/useMedia';
import type { MediaItem } from '@/lib/types';

const COLS = 3;
const GUTTER = 14;

export default function Search() {
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { items } = useMediaItems();
  const [q, setQ] = useState('');

  const tileSize = (width - GUTTER * 2) / COLS;
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return items.filter((i) => i.name.toLowerCase().includes(term));
  }, [q, items]);

  const rows = useMemo(() => chunk(results, COLS), [results]);
  const open = (item: MediaItem) => router.push({ pathname: '/photo/[id]', params: { id: item.id } });

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <ScreenHeader title="Search" />
      <View style={[styles.field, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Feather name="search" size={18} color={palette.fgVariant} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search by filename"
          placeholderTextColor={palette.fgVariant}
          style={[type.bodySm, styles.input, { color: palette.fg }]}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {q.trim() === '' ? (
        <EmptyState icon="search" title="Find a photo" hint="Search by filename. Date and type filters come next." />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(_, i) => `r${i}`}
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 110 }}
          ListEmptyComponent={<EmptyState icon="image" title="No matches" hint={`Nothing named "${q}".`} />}
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
    marginBottom: spacing.md,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, padding: 0 },
});
