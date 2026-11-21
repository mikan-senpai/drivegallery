/**
 * Choose which Drive folders the gallery shows.
 *
 * Browse the folder tree; each folder has one button that flips it between
 * shown and hidden. Rules: "nearest rule wins" (see lib/folders.ts) — include
 * a folder and its subfolders come with it; exclude a subfolder to cut it out.
 * Nothing included = whole Drive.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type } from '@/theme/tokens';
import { useFolderIndex } from '@/hooks/useMedia';
import { useFolderSelection } from '@/store/folderSelection';
import { folderState, pathOf, toggleFor, type FolderIndex, type FolderState } from '@/lib/folders';
import { EmptyState } from '@/components/EmptyState';

export default function Folders() {
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: index, isLoading, error, refetch } = useFolderIndex();
  const selection = useFolderSelection(useShallow((s) => ({ include: s.include, exclude: s.exclude })));
  const setRule = useFolderSelection((s) => s.set);
  const reset = useFolderSelection((s) => s.reset);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const folderId = currentId ?? index?.rootId ?? null;
  const children = useMemo(() => (index && folderId ? (index.children.get(folderId) ?? []) : []), [index, folderId]);
  const crumbs = index && folderId ? pathOf(folderId, index) : [];
  const scoped = selection.include.length > 0 || selection.exclude.length > 0;

  const toggle = (id: string) => {
    if (!index) return;
    const { list, add } = toggleFor(folderState(id, selection, index));
    setRule(list, id, add);
  };

  const summary = !scoped
    ? 'Showing your whole Drive'
    : [
        selection.include.length ? `${selection.include.length} folder${selection.include.length > 1 ? 's' : ''} shown` : 'Whole Drive',
        selection.exclude.length ? `${selection.exclude.length} hidden` : null,
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <View style={[styles.root, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Feather name="chevron-left" size={26} color={palette.fg} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[type.headlineLg, { color: palette.fg }]}>Folders</Text>
          <Text style={[type.bodySm, { color: palette.fgVariant }]}>{summary}</Text>
        </View>
        {scoped ? (
          <Pressable onPress={reset} hitSlop={8}>
            <Text style={[type.label, { color: palette.primary }]}>Reset</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Breadcrumb */}
      {crumbs.length > 0 ? (
        <View style={styles.crumbs}>
          {crumbs.map((c, i) => (
            <View key={c.id} style={styles.crumb}>
              {i > 0 ? <Feather name="chevron-right" size={14} color={palette.fgVariant} /> : null}
              <Pressable onPress={() => setCurrentId(c.id)} hitSlop={6}>
                <Text
                  style={[type.label, { color: i === crumbs.length - 1 ? palette.fg : palette.fgVariant }]}
                  numberOfLines={1}
                >
                  {c.name}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.fgVariant} />
          <Text style={[type.bodySm, { color: palette.fgVariant, marginTop: spacing.sm }]}>Reading your Drive folders…</Text>
        </View>
      ) : error ? (
        <Pressable onPress={() => refetch()}>
          <EmptyState icon="alert-circle" title="Couldn't load folders" hint={`${(error as Error).message}\n\nTap to retry.`} />
        </Pressable>
      ) : (
        <FlatList
          data={children}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 40, gap: spacing.sm }}
          ListHeaderComponent={
            index && folderId && folderId !== index.rootId ? (
              <FolderRow
                name="This folder"
                note={describe(folderState(folderId, selection, index), folderId, selection, index)}
                state={folderState(folderId, selection, index)}
                onToggle={() => toggle(folderId)}
                highlight
              />
            ) : undefined
          }
          ListEmptyComponent={<EmptyState icon="folder" title="No subfolders" hint="This folder has no folders inside it." />}
          renderItem={({ item }) => {
            const state = folderState(item.id, selection, index!);
            const hasChildren = (index!.children.get(item.id)?.length ?? 0) > 0;
            return (
              <FolderRow
                name={item.name}
                note={describe(state, item.id, selection, index!)}
                state={state}
                onToggle={() => toggle(item.id)}
                onOpen={hasChildren ? () => setCurrentId(item.id) : undefined}
              />
            );
          }}
        />
      )}
    </View>
  );
}

function FolderRow({
  name,
  note,
  state,
  onToggle,
  onOpen,
  highlight,
}: {
  name: string;
  note: string;
  state: FolderState;
  onToggle: () => void;
  onOpen?: () => void;
  highlight?: boolean;
}) {
  const { palette } = useTheme();
  const shown = state === 'included' || state === 'inheritedIncluded';
  const explicit = state === 'included' || state === 'excluded';

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: highlight ? palette.surfaceAlt : palette.surface, borderColor: palette.border },
      ]}
    >
      <Pressable style={styles.rowMain} onPress={onOpen} disabled={!onOpen}>
        <View style={[styles.icon, { backgroundColor: (shown ? palette.primary : palette.fgVariant) + '22' }]}>
          <Feather name={shown ? 'folder' : 'folder-minus'} size={20} color={shown ? palette.primary : palette.fgVariant} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyMd, { color: palette.fg }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[type.caption, { color: palette.fgVariant }]} numberOfLines={1}>
            {note}
          </Text>
        </View>
        {onOpen ? <Feather name="chevron-right" size={18} color={palette.fgVariant} /> : null}
      </Pressable>

      <Pressable
        onPress={onToggle}
        hitSlop={6}
        style={[
          styles.toggle,
          explicit && shown && { backgroundColor: palette.primary, borderColor: palette.primary },
          explicit && !shown && { borderColor: palette.fgVariant },
          !explicit && { borderColor: palette.border },
        ]}
      >
        <Text
          style={[
            type.label,
            { color: explicit && shown ? palette.onPrimary : explicit ? palette.fg : palette.fgVariant },
          ]}
        >
          {state === 'included' ? '✓ Shown' : state === 'excluded' ? 'Hidden' : shown ? 'Hide' : 'Show'}
        </Text>
      </Pressable>
    </View>
  );
}

/** One-line explanation of why a folder is shown or hidden. */
function describe(
  state: FolderState,
  id: string,
  sel: { include: string[]; exclude: string[] },
  index: FolderIndex
): string {
  const via = (list: string[]) => {
    const set = new Set(list);
    let cur = index.byId.get(id)?.parent;
    while (cur) {
      if (set.has(cur)) return index.byId.get(cur)?.name ?? '';
      cur = index.byId.get(cur)?.parent;
    }
    return '';
  };
  switch (state) {
    case 'included':
      return 'Shown, with its subfolders';
    case 'excluded':
      return 'Hidden, with its subfolders';
    case 'inheritedIncluded':
      return sel.include.length ? `Shown · via ${via(sel.include)}` : 'Shown · whole Drive';
    case 'inheritedExcluded':
      return `Hidden · via ${via(sel.exclude)}`;
    default:
      return 'Not shown';
  }
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
  back: { paddingRight: spacing.xs },
  crumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    minWidth: 78,
    alignItems: 'center',
  },
});
