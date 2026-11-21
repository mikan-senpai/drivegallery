/**
 * Free up Drive space: exact duplicates (same Drive md5 checksum), largest
 * files, and screenshots. Select, then move to Drive Trash (recoverable for
 * 30 days). For duplicates, every copy but one is pre-selected.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoTile } from '@/components/PhotoTile';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useFolderIndex, useMediaItems, useRemoveMediaItem } from '@/hooks/useMedia';
import { useIndexStatus } from '@/lib/indexSync';
import { useSession } from '@/store/session';
import { AuthCancelledError, ensureWriteAccess } from '@/lib/auth';
import { trashItem } from '@/lib/drive';
import { formatBytes } from '@/lib/format';
import type { FolderIndex } from '@/lib/folders';
import type { MediaItem } from '@/lib/types';

type Tab = 'duplicates' | 'large' | 'screenshots';
type Row = { type: 'group'; id: string; label: string } | { type: 'row'; id: string; items: MediaItem[] };

const COLS = 3;
const GUTTER = 14;
const LARGE_LIMIT = 90;
const SCREENSHOT_NAME = /screen[\s_-]?shot|scrnshot|screen[\s_-]?capture/i;
const SCREENSHOT_FOLDER = /^screen[\s_-]?shots?$/i;

export default function Cleanup() {
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { items } = useMediaItems();
  const { data: folderIndex } = useFolderIndex();
  const indexing = useIndexStatus((s) => s.phase === 'full');
  const demoMode = useSession((s) => s.demoMode);
  const removeFromList = useRemoveMediaItem();

  const [tab, setTab] = useState<Tab>('duplicates');
  const dupes = useMemo(() => findDuplicates(items), [items]);
  const large = useMemo(
    () => [...items].filter((i) => i.sizeBytes).sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0)).slice(0, LARGE_LIMIT),
    [items]
  );
  const screenshots = useMemo(() => items.filter((i) => isScreenshot(i, folderIndex)), [items, folderIndex]);

  // Duplicates start with every extra copy selected; the other tabs start empty.
  const [picked, setPicked] = useState<Record<Tab, Set<string> | null>>({ duplicates: null, large: null, screenshots: null });
  const selected = picked[tab] ?? (tab === 'duplicates' ? new Set(dupes.extras) : new Set<string>());
  const setSelected = (next: Set<string>) => setPicked((p) => ({ ...p, [tab]: next }));
  const toggle = (item: MediaItem) => {
    const next = new Set(selected);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    setSelected(next);
  };

  const tileSize = (width - GUTTER * 2) / COLS;
  const rows: Row[] = useMemo(() => {
    if (tab === 'duplicates') {
      const out: Row[] = [];
      for (const g of dupes.groups) {
        out.push({ type: 'group', id: `g-${g[0].md5}`, label: `${g.length} copies · ${formatBytes(g[0].sizeBytes)} each` });
        out.push(...chunkRows(g, `g-${g[0].md5}`));
      }
      return out;
    }
    return chunkRows(tab === 'large' ? large : screenshots, tab);
  }, [tab, dupes, large, screenshots]);

  const all = tab === 'duplicates' ? dupes.groups.flat() : tab === 'large' ? large : screenshots;
  const chosen = all.filter((i) => selected.has(i.id));
  const freed = chosen.reduce((sum, i) => sum + (i.sizeBytes ?? 0), 0);

  const [progress, setProgress] = useState<string | null>(null);
  const trash = () => {
    if (!chosen.length) return;
    Alert.alert(
      `Move ${chosen.length} item${chosen.length > 1 ? 's' : ''} to Trash?`,
      `Frees about ${formatBytes(freed)} of Drive storage once Trash is emptied. You can restore them from Drive for 30 days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Trash',
          style: 'destructive',
          onPress: async () => {
            if (demoMode) {
              removeFromList(chosen.map((i) => i.id));
              setSelected(new Set());
              return;
            }
            try {
              if (!(await ensureWriteAccess())) return;
              const done: string[] = [];
              for (let i = 0; i < chosen.length; i += 8) {
                setProgress(`Moving ${Math.min(i + 8, chosen.length)} of ${chosen.length}…`);
                const batch = chosen.slice(i, i + 8);
                const results = await Promise.allSettled(batch.map((m) => trashItem(m.id)));
                results.forEach((r, j) => r.status === 'fulfilled' && done.push(batch[j].id));
              }
              removeFromList(done);
              setSelected(new Set());
              const failed = chosen.length - done.length;
              if (failed) Alert.alert('Some items were not moved', `${failed} couldn't be moved to Trash. Try again.`);
            } catch (e) {
              if (!(e instanceof AuthCancelledError)) Alert.alert('Could not move to Trash', e instanceof Error ? e.message : 'Try again.');
            } finally {
              setProgress(null);
            }
          },
        },
      ]
    );
  };

  const empty =
    tab === 'duplicates'
      ? {
          icon: 'copy' as const,
          title: indexing ? 'Still scanning your Drive…' : 'No duplicates',
          hint: indexing ? 'Duplicates show up once indexing finishes.' : 'Every photo and video here is unique.',
        }
      : tab === 'large'
        ? { icon: 'hard-drive' as const, title: 'Nothing here yet', hint: 'Your largest files will appear here.' }
        : { icon: 'smartphone' as const, title: 'No screenshots', hint: 'Files or folders named "Screenshot" show up here.' };

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={palette.fg} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[type.headlineLg, { color: palette.fg }]}>Free up space</Text>
          <Text style={[type.bodySm, { color: palette.fgVariant }]}>
            {formatBytes(dupes.wasted)} in duplicate copies
          </Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['duplicates', `Duplicates · ${dupes.groups.length}`],
            ['large', 'Large files'],
            ['screenshots', `Screenshots · ${screenshots.length}`],
          ] as const
        ).map(([key, label]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[
                styles.tab,
                { borderColor: active ? 'transparent' : palette.border, backgroundColor: active ? palette.primary : 'transparent' },
              ]}
            >
              <Text style={[type.label, { color: active ? palette.onPrimary : palette.fgVariant }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlashList
        data={rows}
        keyExtractor={(r) => r.id}
        getItemType={(r) => r.type}
        extraData={selected}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 120 }}
        ListEmptyComponent={<EmptyState icon={empty.icon} title={empty.title} hint={empty.hint} />}
        renderItem={({ item: row }) =>
          row.type === 'group' ? (
            <Text style={[type.uppercase, styles.group, { color: palette.fgVariant }]}>{row.label}</Text>
          ) : (
            <View style={styles.gridRow}>
              {row.items.map((m) => (
                <View key={m.id}>
                  <PhotoTile item={m} size={tileSize} onPress={toggle} selecting selected={selected.has(m.id)} />
                  <Text style={styles.size}>{formatBytes(m.sizeBytes)}</Text>
                </View>
              ))}
            </View>
          )
        }
      />

      {chosen.length ? (
        <View style={[styles.barWrap, { bottom: insets.bottom + 18 }]}>
          <Pressable
            onPress={trash}
            disabled={!!progress}
            style={[styles.bar, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            {progress ? <ActivityIndicator size="small" color={palette.fg} /> : <Feather name="trash-2" size={19} color={palette.fg} />}
            <Text style={[type.label, { color: palette.fg }]}>
              {progress ?? `Move ${chosen.length} to Trash · frees ${formatBytes(freed)}`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Groups of identical files (same md5 and size), with all-but-one copy marked as extras. */
function findDuplicates(items: MediaItem[]) {
  const byHash = new Map<string, MediaItem[]>();
  for (const i of items) {
    if (!i.md5 || !i.sizeBytes) continue;
    const key = `${i.md5}:${i.sizeBytes}`;
    const list = byHash.get(key);
    if (list) list.push(i);
    else byHash.set(key, [i]);
  }
  const groups = [...byHash.values()]
    .filter((g) => g.length > 1)
    .map((g) => [...g].sort((a, b) => keeperScore(a) - keeperScore(b)))
    .sort((a, b) => (b[0].sizeBytes ?? 0) * (b.length - 1) - (a[0].sizeBytes ?? 0) * (a.length - 1));
  const extras = groups.flatMap((g) => g.slice(1).map((i) => i.id));
  const wasted = groups.reduce((sum, g) => sum + (g[0].sizeBytes ?? 0) * (g.length - 1), 0);
  return { groups, extras, wasted };
}

/** Lower = better copy to keep: avoid "(1)" / "copy" names, then prefer the shorter, original-looking name. */
function keeperScore(i: MediaItem): number {
  const copyish = /\(\d+\)|\bcopy\b|-\d+\.\w+$/i.test(i.name) ? 1000 : 0;
  return copyish + i.name.length;
}

function isScreenshot(i: MediaItem, index: FolderIndex | undefined): boolean {
  if (i.kind !== 'photo') return false;
  if (SCREENSHOT_NAME.test(i.name)) return true;
  const folder = i.parents?.[0] ? index?.byId.get(i.parents[0])?.name : undefined;
  return !!folder && SCREENSHOT_FOLDER.test(folder);
}

function chunkRows(list: MediaItem[], prefix: string): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < list.length; i += COLS) out.push({ type: 'row', id: `${prefix}-${list[i].id}`, items: list.slice(i, i + COLS) });
  return out;
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
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth },
  group: { marginHorizontal: 6, marginTop: spacing.md, marginBottom: spacing.sm },
  gridRow: { flexDirection: 'row' },
  size: {
    position: 'absolute',
    right: 8,
    bottom: 7,
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Outfit_400Regular',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 3,
  },
  barWrap: { position: 'absolute', left: 22, right: 22 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
