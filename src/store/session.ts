/** Session + account state. Rehydrated from secure storage on launch. */
import { create } from 'zustand';
import { loadTokens, signIn, signOut, AuthCancelledError } from '@/lib/auth';
import { getMeta, setMeta } from '@/lib/mediaIndex';
import { resetIndex } from '@/lib/indexSync';

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
    const tokens = await loadTokens();
    set(tokens ? { status: 'signedIn', email: tokens.email } : { status: 'signedOut' });
  },

  connect: async () => {
    try {
      const tokens = await signIn();
      // The offline index belongs to one account: start fresh if a different one signs in.
      const indexedFor = await getMeta('account');
      if (indexedFor && indexedFor !== tokens.email) await resetIndex();
      if (tokens.email) await setMeta('account', tokens.email);
      set({ status: 'signedIn', email: tokens.email, demoMode: false });
    } catch (err) {
      if (err instanceof AuthCancelledError) return;
      throw err;
    }
  },

  enterDemo: () => set({ status: 'signedIn', demoMode: true, email: 'demo@drivegallery' }),

  disconnect: async () => {
    if (!useSession.getState().demoMode) {
      await signOut();
      await resetIndex();
    }
    set({ status: 'signedOut', email: undefined, demoMode: false });
  },
}));
