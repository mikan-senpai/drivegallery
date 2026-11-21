/** Which Drive folders the gallery shows. Persisted on the device. */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FolderSelection } from '@/lib/folders';

interface FolderSelectionState extends FolderSelection {
  set: (list: 'include' | 'exclude', id: string, add: boolean) => void;
  reset: () => void;
}

export const useFolderSelection = create<FolderSelectionState>()(
  persist(
    (set) => ({
      include: [],
      exclude: [],
      set: (list, id, add) =>
        set((s) => {
          // A folder lives in at most one list.
          const include = s.include.filter((x) => x !== id);
          const exclude = s.exclude.filter((x) => x !== id);
          if (add) (list === 'include' ? include : exclude).push(id);
          return { include, exclude };
        }),
      reset: () => set({ include: [], exclude: [] }),
    }),
    { name: 'folder-selection', storage: createJSONStorage(() => AsyncStorage) }
  )
);
