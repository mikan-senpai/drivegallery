/**
 * Media access for the UI. In demo mode returns mock data; otherwise pages
 * through Drive via TanStack Query, scoped by the user's folder selection:
 *
 *  - nothing selected → whole Drive
 *  - only exclusions → whole Drive, excluded folders filtered out client-side
 *  - folders included → query just the resolved folder set, in chunks (Drive's
 *    query length is limited, so ~30 folders per request)
 *
 * A SQLite-backed index + Changes API delta sync replaces live paging in a
 * later phase (see PRD).
 */
import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { listMedia } from '@/lib/drive';
import { mockMedia } from '@/lib/mock';
import { groupByDay } from '@/lib/grouping';
import { loadFolderIndex, resolveScope, type FolderIndex } from '@/lib/folders';
import { useSession } from '@/store/session';
import { useFolderSelection } from '@/store/folderSelection';
import type { MediaItem } from '@/lib/types';

/** Folders per Drive query when scoped to a selection. */
const FOLDER_CHUNK = 30;

interface PageParam {
  chunk: number;
  token?: string;
}
interface MediaPage {
  items: MediaItem[];
  next?: PageParam;
}

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

  const scope = useMemo(() => resolveScope(selection, folderIndex.data), [selection, folderIndex.data]);
  const scopeKey = scoped ? `${selection.include.join(',')}|${selection.exclude.join(',')}` : 'all';

  const demo = useQuery({
    queryKey: ['media', 'demo'],
    queryFn: async () => mockMedia(),
    enabled: demoMode,
    staleTime: Infinity,
  });

  const live = useInfiniteQuery({
    queryKey: ['media', 'drive', scopeKey],
    initialPageParam: { chunk: 0 } as PageParam,
    getNextPageParam: (last: MediaPage) => last.next,
    enabled: !demoMode && (!scoped || folderIndex.isSuccess),
    queryFn: async ({ pageParam }): Promise<MediaPage> => {
      if (scope.mode === 'folders') {
        const chunks = chunk(scope.allowed, FOLDER_CHUNK);
        if (chunks.length === 0) return { items: [] };
        const page = await listMedia(pageParam.token, 200, chunks[pageParam.chunk]);
        const next = page.nextPageToken
          ? { chunk: pageParam.chunk, token: page.nextPageToken }
          : pageParam.chunk + 1 < chunks.length
            ? { chunk: pageParam.chunk + 1 }
            : undefined;
        return { items: page.items, next };
      }

      const page = await listMedia(pageParam.token);
      const next = page.nextPageToken ? { chunk: 0, token: page.nextPageToken } : undefined;
      if (scope.mode === 'allExcept') {
        const known = folderIndex.data?.byId;
        // Keep items in allowed folders, and items outside My Drive's tree (e.g. shared with me).
        const items = page.items.filter((i) => {
          const parent = i.parents?.[0];
          return !parent || !known?.has(parent) || scope.allowed.has(parent);
        });
        return { items, next };
      }
      return { items: page.items, next };
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

  return {
    items: live.data?.pages.flatMap((p) => p.items) ?? [],
    isLoading: live.isLoading || (scoped && folderIndex.isLoading),
    error: folderIndex.error ?? live.error,
    hasMore: Boolean(live.hasNextPage),
    loadMore: () => {
      if (live.hasNextPage && !live.isFetchingNextPage) void live.fetchNextPage();
    },
    refetch: () => {
      if (scoped) void folderIndex.refetch();
      void live.refetch();
    },
  };
}

export function useTimeline() {
  const media = useMediaItems();
  const rows = useMemo(() => groupByDay(media.items), [media.items]);
  return { ...media, rows };
}

/** Drop items from the loaded media (e.g. after moving them to Drive trash). */
export function useRemoveMediaItem(): (ids: string | string[]) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (ids: string | string[]) => {
      const gone = new Set(Array.isArray(ids) ? ids : [ids]);
      queryClient.setQueriesData<InfiniteData<MediaPage>>({ queryKey: ['media', 'drive'] }, (data) =>
        data
          ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((i) => !gone.has(i.id)) })) }
          : data
      );
      queryClient.setQueryData<MediaItem[]>(['media', 'demo'], (data) => data?.filter((i) => !gone.has(i.id)));
    },
    [queryClient]
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
