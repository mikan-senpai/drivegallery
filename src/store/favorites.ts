/** Favorite Drive files, by file id. App-side only (Drive has no "favorite"). Persisted. */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoritesState {
  /** id → true. A record (not a Set) so it serialises to storage as-is. */
  ids: Record<string, true>;
  toggle: (id: string) => void;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set) => ({
      ids: {},
      toggle: (id) =>
        set((s) => {
          const ids = { ...s.ids };
          if (ids[id]) delete ids[id];
          else ids[id] = true;
          return { ids };
        }),
    }),
    { name: 'favorites', storage: createJSONStorage(() => AsyncStorage) }
  )
);

/** Whether one item is a favorite (re-renders only when that item changes). */
export function useIsFavorite(id: string | undefined): boolean {
  return useFavorites((s) => (id ? Boolean(s.ids[id]) : false));
}
