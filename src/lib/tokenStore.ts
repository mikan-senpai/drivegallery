/**
 * Current Google access token, readable from UI components (e.g. image
 * request headers for Drive thumbnails). The auth module is the only writer.
 */
import { create } from 'zustand';

interface TokenState {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
}

export const useTokenStore = create<TokenState>((set) => ({
  accessToken: null,
  setAccessToken: (accessToken) => set({ accessToken }),
}));

/** Headers for authenticated Drive image requests, or undefined when signed out. */
export function useAuthHeaders(): Record<string, string> | undefined {
  const token = useTokenStore((s) => s.accessToken);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
