/**
 * Google authentication + token lifecycle.
 *
 * Flow:
 *  - First connect: native Google account picker → one-time Drive consent.
 *  - Later launches: silent sign-in, no UI. Access tokens refresh in the
 *    background; on Android the cached token is cleared first so a stale one
 *    is never reused.
 *
 * Tokens live in expo-secure-store (Keychain / Keystore) and are mirrored into
 * `useTokenStore` so image components can send them as request headers.
 *
 * The native module is loaded LAZILY (see `gsi()`): importing it at module
 * scope calls TurboModuleRegistry.getEnforcing('RNGoogleSignin'), which throws
 * in Expo Go. Loading on demand keeps demo mode working there; real sign-in
 * needs the development build.
 */
import * as SecureStore from 'expo-secure-store';
import { useTokenStore } from './tokenStore';
import type { GoogleTokens } from './types';

const TOKEN_KEY = 'google.tokens';
/** Google access tokens last ~1h; refresh a little early. */
const TOKEN_TTL_MS = 55 * 60 * 1000;

/** Read-only Drive access. */
export const SCOPES_READONLY = ['https://www.googleapis.com/auth/drive.readonly'];

export class AuthCancelledError extends Error {}
export class NativeUnavailableError extends Error {
  constructor() {
    super('Google Sign-In needs a development build — it is not available in Expo Go.');
  }
}

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');
let moduleRef: GoogleSigninModule | null = null;

/** Lazily load the native module, surfacing a friendly error in Expo Go. */
function gsi(): GoogleSigninModule {
  if (moduleRef) return moduleRef;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    moduleRef = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
  } catch {
    throw new NativeUnavailableError();
  }
  return moduleRef;
}

let configured = false;

function configure(): void {
  if (configured) return;
  gsi().GoogleSignin.configure({
    scopes: SCOPES_READONLY,
    // Web client ID: lets Google issue tokens for this app. Not a secret.
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    // No backend, so no server auth code / forced re-consent.
    offlineAccess: false,
  });
  configured = true;
}

/** Interactive sign-in: account picker, then Drive consent on first use. */
export async function signIn(): Promise<GoogleTokens> {
  const { GoogleSignin, statusCodes, isSuccessResponse } = gsi();
  configure();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new AuthCancelledError('Sign-in cancelled');

    const { accessToken } = await GoogleSignin.getTokens();
    const tokens: GoogleTokens = {
      accessToken,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      idToken: response.data.idToken ?? undefined,
      email: response.data.user.email,
    };
    await persistTokens(tokens);
    return tokens;
  } catch (err: unknown) {
    if (err instanceof AuthCancelledError) throw err;
    const code = (err as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) throw new AuthCancelledError('Sign-in cancelled');
    throw err;
  }
}

/**
 * Returns a valid access token, refreshing silently when it has expired.
 * Pass `force` after the API rejects a token (401) to skip the expiry check.
 */
export async function getValidAccessToken(force = false): Promise<string | null> {
  const stored = await loadTokens();
  if (!force && stored && stored.expiresAt > Date.now()) {
    useTokenStore.getState().setAccessToken(stored.accessToken);
    return stored.accessToken;
  }

  const { GoogleSignin } = gsi();
  configure();
  if (!GoogleSignin.hasPreviousSignIn()) return null;

  try {
    // Android caches access tokens; drop the stale one so getTokens() mints a fresh one.
    if (stored?.accessToken) await GoogleSignin.clearCachedAccessToken(stored.accessToken);
    const silent = await GoogleSignin.signInSilently();
    if (silent.type !== 'success') return null;
    const { accessToken } = await GoogleSignin.getTokens();
    await persistTokens({
      accessToken,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      email: silent.data.user.email ?? stored?.email,
    });
    return accessToken;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    const { GoogleSignin } = gsi();
    configure();
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
  } catch {
    // Native module unavailable (Expo Go) or already signed out — clear local state anyway.
  } finally {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    useTokenStore.getState().setAccessToken(null);
  }
}

export async function loadTokens(): Promise<GoogleTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as GoogleTokens) : null;
}

async function persistTokens(tokens: GoogleTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
  useTokenStore.getState().setAccessToken(tokens.accessToken);
}
