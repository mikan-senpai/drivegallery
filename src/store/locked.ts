/**
 * Drive folders moved into the Locked folder. Their media is excluded
 * everywhere (like hidden folders) and only viewable after biometric unlock.
 * Persisted on device; nothing changes in Drive.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LockedState {
  folders: string[];
  lock: (id: string) => void;
  unlock: (id: string) => void;
}

export const useLocked = create<LockedState>()(
  persist(
    (set) => ({
      folders: [],
      lock: (id) => set((s) => (s.folders.includes(id) ? s : { folders: [...s.folders, id] })),
      unlock: (id) => set((s) => ({ folders: s.folders.filter((f) => f !== id) })),
    }),
    { name: 'locked-folders', storage: createJSONStorage(() => AsyncStorage) }
  )
);

export const LOCKED_ALBUM = 'locked';
