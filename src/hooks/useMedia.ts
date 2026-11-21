/**
 * Media access for the UI.
 *
 * Real accounts read from the offline SQLite index (lib/mediaIndex.ts), kept
 * in sync with Drive by lib/indexSync.ts — so the grid appears instantly from
 * the device and covers the whole library. The folder selection is applied in
 * SQL. Demo mode returns mock media.
 *
 * Public API (useMediaItems / useTimeline / useRemoveMediaItem / useFolderIndex)
 * is unchanged from the earlier live-paging version.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { mockMedia } from '@/lib/mock';
import { groupByDay } from '@/lib/grouping';
import { loadFolderIndex, resolveScope, type FolderIndex } from '@/lib/folders';
import { queryMedia } from '@/lib/mediaIndex';
import { ensureSynced, removeFromIndex, syncIndex, useIndexStatus } from '@/lib/indexSync';
import { useSession } from '@/store/session';
import { useFolderSelection } from '@/store/folderSelection';
import type { MediaItem } from '@/lib/types';

/** The user's Drive folder tree (cached 10 min). */
export function useFolderIndex(enabled = true) {
  const demoMode = useSession((s) => s.demoMode);
  return useQuery<FolderIndex>({
    queryKey: ['folders'],
    queryFn: loadFolderIndex,
    enabled: enabled && !demoMode,
    staleTime: 10 * 60 * 1000,
  });
}

export function useMediaItems(): {
  items: MediaItem[];
  isLoading: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
} {
  const demoMode = useSession((s) => s.demoMode);
  const selection = useFolderSelection(useShallow((s) => ({ include: s.include, exclude: s.exclude })));
  const scoped = selection.include.length > 0 || selection.exclude.length > 0;
  const folderIndex = useFolderIndex(scoped);
  const { version, phase, error: syncError } = useIndexStatus(
    useShallow((s) => ({ version: s.version, phase: s.phase, error: s.error }))
  );

  // Kick off the session's sync (no-op after the first mount).
  useEffect(() => {
    if (!demoMode) ensureSynced();
  }, [demoMode]);

  const scope = useMemo(() => resolveScope(selection, folderIndex.data), [selection, folderIndex.data]);
  const scopeKey = scoped ? `${selection.include.join(',')}|${selection.exclude.join(',')}` : 'all';

  const demo = useQuery({
    queryKey: ['media', 'demo'],
    queryFn: async () => mockMedia(),
    enabled: demoMode,
    staleTime: Infinity,
  });

  const indexed = useQuery({
    queryKey: ['index', scopeKey, version],
    enabled: !demoMode && (!scoped || folderIndex.isSuccess),
    placeholderData: keepPreviousData,
    queryFn: () => {
      // "Whole Drive except…" filters by the folders that fall out of scope, plus any
      // directly hidden folders outside My Drive's tree (e.g. albums shared with you).
      const excluded =
        scope.mode === 'allExcept' && folderIndex.data
          ? [
              ...new Set([
                ...[...folderIndex.data.byId.keys()].filter((id) => !scope.allowed.has(id)),
                ...selection.exclude,
              ]),
            ]
          : [];
      return queryMedia(scope, excluded);
    },
  });

  if (demoMode) {
    return {
      items: demo.data ?? [],
      isLoading: demo.isLoading,
      error: demo.error,
      hasMore: false,
      loadMore: () => {},
      refetch: () => void demo.refetch(),
    };
  }

  const items = indexed.data ?? [];
  const firstScan = phase === 'full' && items.length === 0;
  return {
    items,
    isLoading: indexed.isLoading || firstScan || (scoped && folderIndex.isLoading),
    // Only surface sync errors when there's nothing cached to show.
    error: items.length ? null : (folderIndex.error ?? syncError ?? indexed.error),
    hasMore: false,
    loadMore: () => {},
    refetch: () => {
      if (scoped) void folderIndex.refetch();
      void syncIndex().catch(() => {});
    },
  };
}

export function useTimeline() {
  const media = useMediaItems();
  const rows = useMemo(() => groupByDay(media.items), [media.items]);
  return { ...media, rows };
}

/** Drop items from the gallery right away (e.g. after moving them to Drive trash). */
export function useRemoveMediaItem(): (ids: string | string[]) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (ids: string | string[]) => {
      const list = Array.isArray(ids) ? ids : [ids];
      const gone = new Set(list);
      // Optimistic: update every cached view now; the index catches up below.
      queryClient.setQueriesData<MediaItem[]>({ queryKey: ['index'] }, (data) => data?.filter((i) => !gone.has(i.id)));
      queryClient.setQueryData<MediaItem[]>(['media', 'demo'], (data) => data?.filter((i) => !gone.has(i.id)));
      void removeFromIndex(list);
    },
    [queryClient]
  );
}
