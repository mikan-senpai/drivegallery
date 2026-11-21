/**
 * Multi-select state for the photo grid. Shared so the tab bar can hide itself
 * while the selection action bar is showing.
 */
import { create } from 'zustand';

interface SelectionState {
  /** Selected item ids, in the order they were picked. */
  ids: string[];
  active: boolean;
  start: (id: string) => void;
  toggle: (id: string) => void;
  clear: () => void;
}

export const useSelection = create<SelectionState>((set) => ({
  ids: [],
  active: false,
  start: (id) => set({ active: true, ids: [id] }),
  toggle: (id) =>
    set((s) => {
      const ids = s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id];
      // Deselecting the last item leaves selection mode, like Samsung/Google Photos.
      return ids.length ? { ids } : { ids, active: false };
    }),
  clear: () => set({ ids: [], active: false }),
}));
