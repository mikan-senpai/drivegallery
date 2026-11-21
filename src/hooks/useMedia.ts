/**
 * Media access for the UI. In demo mode returns mock data; otherwise paginates
 * Drive via TanStack Query's infinite query. A SQLite-backed index + Changes API
 * delta sync replaces the live paging here in a later phase (see PRD).
 */
import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { listMedia } from '@/lib/drive';
import { mockMedia } from '@/lib/mock';
import { groupByDay } from '@/lib/grouping';
import { useSession } from '@/store/session';
import type { MediaItem, Page } from '@/lib/types';

export function useMediaItems(): {
  items: MediaItem[];
  isLoading: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
} {
  const demoMode = useSession((s) => s.demoMode);

  const demo = useQuery({
    queryKey: ['media', 'demo'],
    queryFn: async () => mockMedia(),
    enabled: demoMode,
    staleTime: Infinity,
  });

  const live = useInfiniteQuery({
    queryKey: ['media', 'drive'],
    queryFn: ({ pageParam }) => listMedia(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextPageToken,
    enabled: !demoMode,
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
    isLoading: live.isLoading,
    error: live.error,
    hasMore: Boolean(live.hasNextPage),
    loadMore: () => {
      if (live.hasNextPage && !live.isFetchingNextPage) void live.fetchNextPage();
    },
    refetch: () => void live.refetch(),
  };
}

export function useTimeline() {
  const media = useMediaItems();
  const rows = useMemo(() => groupByDay(media.items), [media.items]);
  return { ...media, rows };
}

/** Drop an item from the loaded media (e.g. after moving it to Drive trash). */
export function useRemoveMediaItem(): (id: string) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (id: string) => {
      queryClient.setQueryData<InfiniteData<Page<MediaItem>>>(['media', 'drive'], (data) =>
        data
          ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) })) }
          : data
      );
      queryClient.setQueryData<MediaItem[]>(['media', 'demo'], (data) => data?.filter((i) => i.id !== id));
    },
    [queryClient]
  );
}
