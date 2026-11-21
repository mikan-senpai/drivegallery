/**
 * Google authentication + token lifecycle.
 *
 * Uses @react-native-google-signin for the native consent flow and
 * expo-secure-store (Keychain / Keystore) for token storage. Access tokens
 * are refreshed silently; the refresh token never leaves secure storage.
 *
 * Requires a native build (dev client or EAS) — Google Sign-In does not run
 * in Expo Go. See README "Auth setup".
 */
import * as SecureStore from 'expo-secure-store';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { GoogleTokens } from './types';

const TOKEN_KEY = 'google.tokens';

/** Read-only Drive access. Write (trash) is requested separately, on demand. */
export const SCOPES_READONLY = ['https://www.googleapis.com/auth/drive.readonly'];
export const SCOPE_WRITE = 'https://www.googleapis.com/auth/drive.file';

let configured = false;

export function configureGoogleSignIn(): void {
  if (configured) return;
  GoogleSignin.configure({
    scopes: SCOPES_READONLY,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    offlineAccess: true,
    forceCodeForRefreshToken: true,
  });
  configured = true;
}

export class AuthCancelledError extends Error {}

export async function signIn(): Promise<GoogleTokens> {
  configureGoogleSignIn();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const user = await GoogleSignin.signIn();
    const { accessToken } = await GoogleSignin.getTokens();
    const tokens: GoogleTokens = {
      accessToken,
      // Google access tokens are ~1h; treat conservatively.
      expiresAt: Date.now() + 55 * 60 * 1000,
      idToken: user.data?.idToken ?? undefined,
      email: user.data?.user.email,
    };
    await persistTokens(tokens);
    return tokens;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) throw new AuthCancelledError('Sign-in cancelled');
    throw err;
  }
}

/** Returns a valid access token, refreshing silently when expired. */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (tokens && tokens.expiresAt - 60_000 > Date.now()) return tokens.accessToken;

  configureGoogleSignIn();
  const hasPrevious = await GoogleSignin.hasPreviousSignIn();
  if (!hasPrevious) return null;
  try {
    await GoogleSignin.signInSilently();
    const { accessToken } = await GoogleSignin.getTokens();
    await persistTokens({
      accessToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
      email: tokens?.email,
    });
    return accessToken;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  configureGoogleSignIn();
  try {
    await GoogleSignin.revokeAccess();
    await GoogleSignin.signOut();
  } finally {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export async function loadTokens(): Promise<GoogleTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as GoogleTokens) : null;
}

async function persistTokens(tokens: GoogleTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}
