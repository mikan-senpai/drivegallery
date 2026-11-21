import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useMediaItems } from '@/hooks/useMedia';

export default function Albums() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { items } = useMediaItems();

  const albums = useMemo(
    () => [
      { id: 'fav', name: 'Favorites', icon: 'heart' as const, count: items.filter((i) => i.favorite).length },
      { id: 'videos', name: 'Videos', icon: 'video' as const, count: items.filter((i) => i.kind === 'video').length },
    ],
    [items]
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <ScreenHeader title="Albums" subtitle="Favorites, videos, and Drive folders" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 110, gap: spacing.sm }}>
        {albums.map((a) => (
          <View key={a.id} style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.halo, { backgroundColor: palette.primary + '22' }]}>
              <Feather name={a.icon} size={22} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyMd, { color: palette.fg }]}>{a.name}</Text>
              <Text style={[type.caption, { color: palette.fgVariant }]}>{a.count} items</Text>
            </View>
            <Feather name="chevron-right" size={20} color={palette.fgVariant} />
          </View>
        ))}
        <View style={{ marginTop: spacing.md }}>
          <EmptyState icon="folder" title="Drive folders" hint="Folders containing media appear here after indexing." />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  halo: { width: 48, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
