/** Session + account state. Rehydrated from secure storage on launch. */
import { create } from 'zustand';
import { loadTokens, signIn, signOut, AuthCancelledError } from '@/lib/auth';
import { getMeta, setMeta } from '@/lib/mediaIndex';
import { resetIndex } from '@/lib/indexSync';
import { stopSettingsSync, useSettingsSync } from '@/lib/settingsSync';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Survives sign-out (unlike the index), so a different account is always detected. */
const LAST_ACCOUNT_KEY = 'last-account';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: Status;
  email?: string;
  /** Demo mode renders mock media without a native auth build. */
  demoMode: boolean;
  restore: () => Promise<void>;
  connect: () => Promise<void>;
  enterDemo: () => void;
  disconnect: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  demoMode: false,

  restore: async () => {
    const tokens = await loadTokens().catch(() => null);
    set(tokens ? { status: 'signedIn', email: tokens.email } : { status: 'signedOut' });
  },

  connect: async () => {
    try {
      const tokens = await signIn();
      // Index and settings belong to one account: start fresh if a different one signs in.
      // (That account's own settings then load from its Drive.)
      const lastAccount = await AsyncStorage.getItem(LAST_ACCOUNT_KEY).catch(() => null);
      const indexedFor = await getMeta('account');
      if ((lastAccount && lastAccount !== tokens.email) || (indexedFor && indexedFor !== tokens.email)) {
        await stopSettingsSync({ clearLocal: true });
        await resetIndex();
      }
      if (tokens.email) {
        await setMeta('account', tokens.email);
        await AsyncStorage.setItem(LAST_ACCOUNT_KEY, tokens.email).catch(() => {});
      }
      set({ status: 'signedIn', email: tokens.email, demoMode: false });
    } catch (err) {
      if (err instanceof AuthCancelledError) return;
      throw err;
    }
  },

  enterDemo: () => set({ status: 'signedIn', demoMode: true, email: 'demo@drivegallery' }),

  disconnect: async () => {
    if (!useSession.getState().demoMode) {
      // Only wipe on-phone settings if they're safely backed up in the account.
      await stopSettingsSync({ clearLocal: useSettingsSync.getState().enabled === true });
      await signOut();
      await resetIndex();
    }
    set({ status: 'signedOut', email: undefined, demoMode: false });
  },
}));
