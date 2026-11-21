/**
 * Fingerprint / face unlock with the phone's PIN or pattern as fallback.
 * The native module is required lazily so builds without it show a clear
 * message instead of crashing at import time.
 */
export type UnlockResult = 'ok' | 'cancelled' | 'no-lock' | 'unavailable';

type LocalAuth = typeof import('expo-local-authentication');

function localAuth(): LocalAuth | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-local-authentication') as LocalAuth;
  } catch {
    return null;
  }
}

export async function unlock(reason: string): Promise<UnlockResult> {
  const LA = localAuth();
  if (!LA) return 'unavailable';
  const level = await LA.getEnrolledLevelAsync();
  // NONE = no fingerprint, face or screen lock at all — nothing to protect the folder with.
  if (level === LA.SecurityLevel.NONE) return 'no-lock';
  const res = await LA.authenticateAsync({ promptMessage: reason, cancelLabel: 'Cancel', disableDeviceFallback: false });
  return res.success ? 'ok' : 'cancelled';
}
