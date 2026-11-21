/**
 * Settings that follow your Google account: shown/hidden folders, Locked
 * folder and favorites, stored as one JSON file in Drive's private
 * appDataFolder (invisible in Drive, and the app's scope there can't see
 * your files).
 *
 *  - On sign-in / launch: pull. The newer side wins (remote `updatedAt` vs
 *    the local one), so a fresh phone or reinstall picks up your settings.
 *  - On any change: push ~1.5s later.
 *  - Needs the drive.appdata scope. New sign-ins grant it up front; older
 *    sessions turn sync on from You > Library (one consent prompt). Without
 *    it, settings still persist on the phone as before.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appDataFind, appDataRead, appDataWrite } from './drive';
import { ensureAppDataAccess } from './auth';
import { useFolderSelection } from '@/store/folderSelection';
import { useLocked } from '@/store/locked';
import { useFavorites } from '@/store/favorites';

const FILE = 'drivegallery-settings.json';
const LOCAL_KEY = 'settings-sync';
const PUSH_DELAY_MS = 1500;

interface SyncedSettings {
  v: 1;
  updatedAt: number;
  include: string[];
  exclude: string[];
  locked: string[];
  favorites: string[];
}

interface LocalMeta {
  updatedAt: number;
  fileId: string | null;
}

interface SyncStatus {
  /** null = not known yet; false = no permission (sync off). */
  enabled: boolean | null;
  syncing: boolean;
  lastSynced: number | null;
  error: string | null;
}

export const useSettingsSync = create<SyncStatus>(() => ({ enabled: null, syncing: false, lastSynced: null, error: null }));
const status = (p: Partial<SyncStatus>) => useSettingsSync.setState(p);

let meta: LocalMeta = { updatedAt: 0, fileId: null };
let applying = false;
let started = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribers: (() => void)[] = [];

const isScopeError = (e: unknown) => e instanceof Error && /insufficient|scope|permission/i.test(e.message);

async function loadMeta() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    if (raw) meta = { ...meta, ...(JSON.parse(raw) as Partial<LocalMeta>) };
  } catch {
    // Corrupt or missing — treat as never synced.
  }
}
const saveMeta = () => AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(meta)).catch(() => {});

function snapshot(): SyncedSettings {
  const sel = useFolderSelection.getState();
  return {
    v: 1,
    updatedAt: meta.updatedAt,
    include: sel.include,
    exclude: sel.exclude,
    locked: useLocked.getState().folders,
    favorites: Object.keys(useFavorites.getState().ids),
  };
}

function apply(s: SyncedSettings) {
  applying = true;
  try {
    useFolderSelection.setState({ include: s.include ?? [], exclude: s.exclude ?? [] });
    useLocked.setState({ folders: s.locked ?? [] });
    useFavorites.setState({ ids: Object.fromEntries((s.favorites ?? []).map((id) => [id, true as const])) });
  } finally {
    applying = false;
  }
}

async function pull(): Promise<void> {
  status({ syncing: true, error: null });
  try {
    const id = await appDataFind(FILE);
    status({ enabled: true });
    if (!id) {
      // Nothing saved for this account yet: upload what's on the phone.
      if (meta.updatedAt === 0) meta.updatedAt = Date.now();
      await push();
      return;
    }
    meta.fileId = id;
    const remote = await appDataRead<SyncedSettings>(id);
    if (remote.updatedAt >= meta.updatedAt) {
      apply(remote);
      meta.updatedAt = remote.updatedAt;
      await saveMeta();
      status({ lastSynced: Date.now() });
    } else {
      await push();
    }
  } catch (e) {
    if (isScopeError(e)) status({ enabled: false });
    else status({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    status({ syncing: false });
  }
}

async function push(): Promise<void> {
  status({ syncing: true, error: null });
  try {
    meta.fileId = await appDataWrite(FILE, snapshot(), meta.fileId ?? (await appDataFind(FILE)));
    await saveMeta();
    status({ enabled: true, lastSynced: Date.now() });
  } catch (e) {
    if (isScopeError(e)) status({ enabled: false });
    else status({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    status({ syncing: false });
  }
}

function onLocalChange() {
  if (applying) return;
  meta.updatedAt = Date.now();
  void saveMeta();
  if (useSettingsSync.getState().enabled === false) return; // stays on the phone until sync is turned on
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void push(), PUSH_DELAY_MS);
}

/** Start syncing for the signed-in account (idempotent). */
export async function startSettingsSync(): Promise<void> {
  if (started) return;
  started = true;
  await loadMeta();
  unsubscribers = [
    useFolderSelection.subscribe(onLocalChange),
    useLocked.subscribe(onLocalChange),
    useFavorites.subscribe(onLocalChange),
  ];
  await pull();
}

/** Turn sync on for a session that signed in before it existed (asks Google once). */
export async function enableSettingsSync(): Promise<boolean> {
  if (!(await ensureAppDataAccess())) return false;
  await pull();
  return useSettingsSync.getState().enabled === true;
}

/**
 * Stop syncing (sign-out / account switch). With `clearLocal`, also wipe the
 * on-phone copies — safe when they're backed up in the account.
 */
export async function stopSettingsSync(opts: { clearLocal: boolean }): Promise<void> {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  started = false;
  if (opts.clearLocal) {
    apply({ v: 1, updatedAt: 0, include: [], exclude: [], locked: [], favorites: [] });
    meta = { updatedAt: 0, fileId: null };
    await AsyncStorage.removeItem(LOCAL_KEY).catch(() => {});
  }
  status({ enabled: null, syncing: false, lastSynced: null, error: null });
}
