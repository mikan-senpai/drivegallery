import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoTile } from '@/components/PhotoTile';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing, type } from '@/theme/tokens';
import { useFolderIndex, useMediaItems } from '@/hooks/useMedia';
import { useFavorites } from '@/store/favorites';
import { albumTitle, itemsInAlbum } from '@/lib/albums';
import type { MediaItem } from '@/lib/types';

const COLS = 3;
const GUTTER = 14;

export default function Album() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { items, isLoading } = useMediaItems();
  const { data: folderIndex } = useFolderIndex();
  const favorites = useFavorites((s) => s.ids);

  const albumItems = useMemo(() => itemsInAlbum(items, id, favorites), [items, id, favorites]);
  const rows = useMemo(() => {
    const out: MediaItem[][] = [];
    for (let i = 0; i < albumItems.length; i += COLS) out.push(albumItems.slice(i, i + COLS));
    return out;
  }, [albumItems]);
  const tileSize = (width - GUTTER * 2) / COLS;

  const open = (item: MediaItem) => router.push({ pathname: '/photo/[id]', params: { id: item.id, album: id } });

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={palette.fg} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[type.headlineLg, { color: palette.fg }]} numberOfLines={1}>
            {albumTitle(id, folderIndex)}
          </Text>
          <Text style={[type.bodySm, { color: palette.fgVariant }]}>{albumItems.length.toLocaleString()} items</Text>
        </View>
      </View>

      <FlashList
        data={rows}
        keyExtractor={(row) => row[0].id}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 40 }}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon={id === 'favorites' ? 'heart' : 'image'}
              title={id === 'favorites' ? 'No favorites yet' : 'Nothing here yet'}
              hint={id === 'favorites' ? 'Tap ♥ on any photo to add it here.' : 'This album has no photos or videos.'}
            />
          )
        }
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((m) => (
              <PhotoTile key={m.id} item={m} size={tileSize} onPress={open} />
            ))}
          </View>
        )}
      />
    </View>
  );
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
  row: { flexDirection: 'row' },
});
