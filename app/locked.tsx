/**
 * Locked folder. Opens only after fingerprint / face / screen-lock unlock and
 * locks again when you leave the screen or the app goes to the background.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, AppState, Alert, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoTile } from '@/components/PhotoTile';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useFolderIndex, useLockedItems } from '@/hooks/useMedia';
import { useLocked, LOCKED_ALBUM } from '@/store/locked';
import { unlock } from '@/lib/biometrics';
import type { MediaItem } from '@/lib/types';

const COLS = 3;
const GUTTER = 14;

export default function Locked() {
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const folders = useLocked((s) => s.folders);
  const unlockFolder = useLocked((s) => s.unlock);
  const { data: folderIndex } = useFolderIndex(unlocked);
  const { data: items = [], isLoading } = useLockedItems(unlocked);

  const tryUnlock = useCallback(async () => {
    const result = await unlock('Unlock your Locked folder');
    if (result === 'ok') {
      setMessage(null);
      setUnlocked(true);
    } else if (result === 'no-lock') {
      setMessage('Set up a fingerprint or screen lock on your phone to use the Locked folder.');
    } else if (result === 'unavailable') {
      setMessage('The Locked folder needs the latest version of the app. Install the newest build.');
    }
  }, []);

  // Prompt on arrival; lock again on leaving.
  useFocusEffect(
    useCallback(() => {
      void tryUnlock();
      return () => setUnlocked(false);
    }, [tryUnlock])
  );

  // Lock as soon as the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') setUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  const rows = useMemo(() => {
    const out: MediaItem[][] = [];
    for (let i = 0; i < items.length; i += COLS) out.push(items.slice(i, i + COLS));
    return out;
  }, [items]);
  const tileSize = (width - GUTTER * 2) / COLS;
  const open = (item: MediaItem) => router.push({ pathname: '/photo/[id]', params: { id: item.id, album: LOCKED_ALBUM } });

  const removeFromLocked = (id: string) => {
    const name = folderIndex?.byId.get(id)?.name ?? 'this album';
    Alert.alert(`Move "${name}" out of the Locked folder?`, 'Its photos will show in Photos, Albums and Search again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Move out', onPress: () => unlockFolder(id) },
    ]);
  };

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Feather name="chevron-left" size={26} color={palette.fg} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[type.headlineLg, { color: palette.fg }]}>Locked folder</Text>
        {unlocked ? (
          <Text style={[type.bodySm, { color: palette.fgVariant }]}>
            {folders.length} album{folders.length === 1 ? '' : 's'} · {items.length.toLocaleString()} items
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!unlocked) {
    return (
      <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          <View style={[styles.lockBadge, { backgroundColor: palette.surfaceAlt }]}>
            <Feather name="lock" size={34} color={palette.primary} />
          </View>
          <Text style={[type.headlineSm, { color: palette.fg }]}>Locked</Text>
          <Text style={[type.bodySm, styles.hint, { color: palette.fgVariant }]}>
            {message ?? 'Use your fingerprint or screen lock to see these photos.'}
          </Text>
          <Pressable onPress={tryUnlock} style={[styles.unlockBtn, { backgroundColor: palette.primary }]}>
            <Feather name="unlock" size={17} color={palette.onPrimary} />
            <Text style={[type.label, { color: palette.onPrimary }]}>Unlock</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {header}
      {folders.length ? (
        <View style={styles.albumChips}>
          {folders.map((id) => (
            <Pressable
              key={id}
              onLongPress={() => removeFromLocked(id)}
              onPress={() => removeFromLocked(id)}
              style={[styles.albumChip, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Feather name="folder" size={13} color={palette.primary} />
              <Text style={[type.label, { color: palette.fg }]} numberOfLines={1}>
                {folderIndex?.byId.get(id)?.name ?? 'Album'}
              </Text>
              <Feather name="x" size={13} color={palette.fgVariant} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <FlashList
        data={rows}
        keyExtractor={(row) => row[0].id}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 40 }}
        ListEmptyComponent={
          isLoading ? undefined : (
            <EmptyState
              icon="lock"
              title="Nothing locked yet"
              hint="In Albums, long-press an album and choose Move to Locked folder."
            />
          )
        }
        renderItem={({ item: row }) => (
          <View style={{ flexDirection: 'row' }}>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  lockBadge: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  hint: { textAlign: 'center' },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: radius.full,
  },
  albumChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  albumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
