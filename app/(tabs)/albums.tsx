import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useFolderIndex, useMediaItems } from '@/hooks/useMedia';
import { useFavorites } from '@/store/favorites';
import { useFolderSelection } from '@/store/folderSelection';
import { useLocked } from '@/store/locked';
import { useAuthHeaders } from '@/lib/tokenStore';
import { buildFolderAlbums, FAVORITES_ALBUM, VIDEOS_ALBUM, type FolderAlbum } from '@/lib/albums';
import type { MediaItem } from '@/lib/types';

const GAP = 12;

export default function Albums() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { items, isLoading } = useMediaItems();
  const { data: folderIndex } = useFolderIndex();
  const favorites = useFavorites((s) => s.ids);

  const hidden = useFolderSelection((s) => s.exclude);
  const setRule = useFolderSelection((s) => s.set);
  const [showHidden, setShowHidden] = useState(false);

  const folderAlbums = useMemo(() => buildFolderAlbums(items, folderIndex), [items, folderIndex]);
  const favoriteItems = useMemo(() => items.filter((i) => favorites[i.id]), [items, favorites]);
  const videoItems = useMemo(() => items.filter((i) => i.kind === 'video'), [items]);
  const cardW = (width - spacing.lg * 2 - GAP) / 2;

  const open = (id: string) => router.push({ pathname: '/album/[id]', params: { id } });

  // Hiding an album = excluding its Drive folder, so its photos leave Photos and Search too.
  const lockFolder = useLocked((s) => s.lock);

  // Long-press an album: hide it, or move it behind fingerprint unlock. Nothing changes in Drive.
  const albumActions = (album: FolderAlbum) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      album.name,
      'Hide it, or move it to the Locked folder (opens with your fingerprint). Either way its photos leave Photos and Search, along with any folders inside it. Nothing is deleted from Drive.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Hide', onPress: () => setRule('exclude', album.id, true) },
        {
          text: 'Lock',
          onPress: () => {
            lockFolder(album.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const folderName = (id: string) => folderIndex?.byId.get(id)?.name ?? 'Shared folder';

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <FlatList
        data={folderAlbums}
        keyExtractor={(a) => a.id}
        numColumns={2}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 110, gap: GAP }}
        ListHeaderComponent={
          <View style={{ marginHorizontal: -spacing.lg, gap: spacing.sm }}>
            <ScreenHeader title="Albums" subtitle={`${folderAlbums.length} folders with photos`} />
            <View style={styles.smartRow}>
              <SmartAlbum
                icon="heart"
                name="Favorites"
                count={favoriteItems.length}
                cover={favoriteItems[0]}
                onPress={() => open(FAVORITES_ALBUM)}
              />
              <SmartAlbum
                icon="video"
                name="Videos"
                count={videoItems.length}
                cover={videoItems[0]}
                onPress={() => open(VIDEOS_ALBUM)}
              />
            </View>
            <Pressable
              onPress={() => router.push('/locked')}
              style={[styles.lockedRow, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <View style={[styles.lockedIcon, { backgroundColor: palette.primary + '22' }]}>
                <Feather name="lock" size={16} color={palette.primary} />
              </View>
              <Text style={[type.bodyMd, { color: palette.fg, flex: 1 }]}>Locked folder</Text>
              <Feather name="chevron-right" size={18} color={palette.fgVariant} />
            </Pressable>
            <View style={styles.sectionRow}>
              <Text style={[type.uppercase, { color: palette.fgVariant }]}>Drive folders</Text>
              <Text style={[type.caption, { color: palette.fgVariant }]}>Long-press to hide or lock</Text>
            </View>
          </View>
        }
        ListFooterComponent={
          hidden.length ? (
            <View style={styles.hiddenWrap}>
              <Pressable onPress={() => setShowHidden((v) => !v)} style={styles.sectionRowFlat} hitSlop={6}>
                <Text style={[type.uppercase, { color: palette.fgVariant }]}>Hidden albums · {hidden.length}</Text>
                <Feather name={showHidden ? 'chevron-up' : 'chevron-down'} size={16} color={palette.fgVariant} />
              </Pressable>
              {showHidden
                ? hidden.map((id) => (
                    <View key={id} style={[styles.hiddenRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                      <Feather name="eye-off" size={18} color={palette.fgVariant} />
                      <Text style={[type.bodyMd, { color: palette.fg, flex: 1 }]} numberOfLines={1}>
                        {folderName(id)}
                      </Text>
                      <Pressable
                        onPress={() => setRule('exclude', id, false)}
                        hitSlop={8}
                        style={[styles.unhide, { borderColor: palette.border }]}
                      >
                        <Text style={[type.label, { color: palette.primary }]}>Unhide</Text>
                      </Pressable>
                    </View>
                  ))
                : null}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <EmptyState icon="folder" title="No folders yet" hint="Folders containing your photos and videos show up here." />
          )
        }
        renderItem={({ item }) => (
          <FolderAlbumCard
            album={item}
            width={cardW}
            onPress={() => open(item.id)}
            onLongPress={() => albumActions(item)}
          />
        )}
      />
    </View>
  );
}

function Cover({ item, style }: { item?: MediaItem; style: object }) {
  const headers = useAuthHeaders();
  const { palette } = useTheme();
  return (
    <View style={[style, { backgroundColor: palette.surfaceAlt, overflow: 'hidden' }]}>
      {item?.thumbnailUrl ? (
        <Image
          source={{ uri: item.thumbnailUrl, headers, cacheKey: `${item.id}-grid` }}
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
        />
      ) : null}
    </View>
  );
}

function SmartAlbum({
  icon,
  name,
  count,
  cover,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  name: string;
  count: number;
  cover?: MediaItem;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.smart, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Cover item={cover} style={styles.smartCover} />
      <View style={{ flex: 1 }}>
        <View style={styles.smartTitle}>
          <Feather name={icon} size={14} color={palette.primary} />
          <Text style={[type.bodyMd, { color: palette.fg }]}>{name}</Text>
        </View>
        <Text style={[type.caption, { color: palette.fgVariant }]}>{count.toLocaleString()} items</Text>
      </View>
    </Pressable>
  );
}

function FolderAlbumCard({
  album,
  width,
  onPress,
  onLongPress,
}: {
  album: FolderAlbum;
  width: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={{ width }}>
      <Cover item={album.cover} style={[styles.folderCover, { width, height: width }]} />
      <Text style={[type.bodyMd, { color: palette.fg, marginTop: 8 }]} numberOfLines={1}>
        {album.name}
      </Text>
      <Text style={[type.caption, { color: palette.fgVariant }]} numberOfLines={1}>
        {album.count.toLocaleString()} · {album.location || 'Shared'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  smartRow: { flexDirection: 'row', gap: GAP, paddingHorizontal: spacing.lg },
  smart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  smartCover: { width: 52, height: 52, borderRadius: radius.sm },
  smartTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: spacing.lg,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lockedIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionRowFlat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  hiddenWrap: { marginTop: spacing.xl, gap: spacing.sm },
  hiddenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unhide: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
  folderCover: { borderRadius: radius.lg },
});
