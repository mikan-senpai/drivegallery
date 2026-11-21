/** Photo grid density (columns per row), changed by pinching. Persisted on device. */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MIN_COLS = 2;
export const MAX_COLS = 6;

interface GridPrefsState {
  cols: number;
  /** Positive = more, smaller tiles (pinch in); negative = fewer, bigger (pinch out). */
  step: (delta: number) => void;
}

export const useGridPrefs = create<GridPrefsState>()(
  persist(
    (set) => ({
      cols: 3,
      step: (delta) => set((s) => ({ cols: Math.min(MAX_COLS, Math.max(MIN_COLS, s.cols + delta)) })),
    }),
    { name: 'grid-prefs', storage: createJSONStorage(() => AsyncStorage) }
  )
);
