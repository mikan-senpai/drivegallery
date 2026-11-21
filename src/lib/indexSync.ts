/**
 * Keeps the offline media index (mediaIndex.ts) in step with Drive.
 *
 *  1. First run — full scan, 1000 items per request, resumable. Before scanning
 *     we capture a change-feed token, so anything that changes mid-scan is
 *     picked up by the first delta sync. The grid fills while it scans.
 *  2. Every later launch / pull-to-refresh — delta sync via the Changes API
 *     (adds, edits, trashes, deletes).
 *  3. Every 6h — a background re-list that renews thumbnail links (Drive's
 *     expire after hours) and drops anything the change feed missed.
 *  4. On demand — a single tile whose thumbnail fails to load gets fresh metadata.
 *
 * Only one sync runs at a time; callers share the in-flight promise.
 */
import { create } from 'zustand';
import { getMediaFile, getStartPageToken, isMediaFile, listChanges, listMedia, toMediaItem } from './drive';
import {
  allMediaIds,
  clearIndex,
  countMedia,
  deleteMedia,
  getMeta,
  setMeta,
  upsertMedia,
} from './mediaIndex';
import type { MediaItem } from './types';

const PAGE = 1000;
const THUMB_TTL_MS = 6 * 60 * 60 * 1000;

type Phase = 'idle' | 'full' | 'delta' | 'refresh';

interface IndexStatus {
  phase: Phase;
  /** Rows currently in the index. */
  indexed: number;
  /** True once a full scan has completed at least once. */
  ready: boolean;
  error: string | null;
  /** Bumped whenever index contents change, so readers re-query. */
  version: number;
}

export const useIndexStatus = create<IndexStatus>(() => ({
  phase: 'idle',
  indexed: 0,
  ready: false,
  error: null,
  version: 0,
}));

const status = (patch: Partial<IndexStatus>) => useIndexStatus.setState(patch);
const bump = () => useIndexStatus.setState((s) => ({ version: s.version + 1 }));

let running: Promise<void> | null = null;
let syncedThisSession = false;

/** Sync once per app session (call freely from mounts). */
export function ensureSynced(): void {
  if (syncedThisSession) return;
  syncedThisSession = true;
  void syncIndex().catch(() => {});
}

/** Run a sync now (pull-to-refresh). Concurrent callers share one run. */
export function syncIndex(): Promise<void> {
  if (!running) {
    running = run().finally(() => {
      running = null;
    });
  }
  return running;
}

async function run(): Promise<void> {
  status({ error: null });
  try {
    const done = (await getMeta('full_sync_done')) === '1';
    status({ ready: done, indexed: await countMedia() });
    if (!done) {
      await fullScan();
    } else {
      await deltaSync();
      await maybeRefreshThumbs();
    }
  } catch (e) {
    status({ error: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    status({ phase: 'idle', indexed: await countMedia().catch(() => useIndexStatus.getState().indexed) });
    bump();
  }
}

async function fullScan(): Promise<void> {
  status({ phase: 'full' });
  let start = await getMeta('full_sync_start');
  if (!start) {
    start = await getStartPageToken();
    await setMeta('full_sync_start', start);
  }

  let page = (await getMeta('full_sync_page')) ?? undefined;
  let pages = 0;
  do {
    const res = await listMedia(page, PAGE);
    await upsertMedia(res.items);
    page = res.nextPageToken;
    await setMeta('full_sync_page', page ?? null);
    status({ indexed: await countMedia() });
    // Show the first page immediately, then refresh the grid every few pages.
    if (pages++ % 3 === 0) bump();
  } while (page);

  await setMeta('changes_token', start);
  await setMeta('full_sync_start', null);
  await setMeta('full_sync_done', '1');
  await setMeta('thumbs_at', String(Date.now()));
  status({ ready: true });
}

async function deltaSync(): Promise<void> {
  status({ phase: 'delta' });
  let token = await getMeta('changes_token');
  if (!token) {
    await setMeta('changes_token', await getStartPageToken());
    return;
  }

  while (token) {
    const res = await listChanges(token);
    const upserts: MediaItem[] = [];
    const removes: string[] = [];
    for (const c of res.changes) {
      if (c.removed || !c.file || c.file.trashed || !isMediaFile(c.file)) removes.push(c.fileId);
      else upserts.push(toMediaItem(c.file));
    }
    await deleteMedia(removes);
    await upsertMedia(upserts);

    if (res.newStartPageToken) {
      await setMeta('changes_token', res.newStartPageToken);
      break;
    }
    token = res.nextPageToken ?? null;
    if (token) await setMeta('changes_token', token);
  }
}

async function maybeRefreshThumbs(): Promise<void> {
  const last = Number((await getMeta('thumbs_at')) ?? 0);
  if (Date.now() - last < THUMB_TTL_MS) return;

  status({ phase: 'refresh' });
  const seen = new Set<string>();
  let page: string | undefined;
  do {
    const res = await listMedia(page, PAGE);
    await upsertMedia(res.items);
    for (const i of res.items) seen.add(i.id);
    page = res.nextPageToken;
  } while (page);

  // Reconcile: anything indexed that Drive no longer lists.
  await deleteMedia((await allMediaIds()).filter((id) => !seen.has(id)));
  await setMeta('thumbs_at', String(Date.now()));
}

// ---- Single-thumbnail repair (tile failed to load) ----

const tried = new Set<string>();
const queue = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Called when a tile's thumbnail fails; renews that file's links (once per session). */
export function refreshThumbnail(id: string): void {
  if (tried.has(id)) return;
  tried.add(id);
  queue.add(id);
  if (!flushTimer) flushTimer = setTimeout(() => void flushThumbs(), 400);
}

async function flushThumbs(): Promise<void> {
  flushTimer = null;
  const ids = [...queue];
  queue.clear();
  const gone: string[] = [];
  const fresh: MediaItem[] = [];
  // Small parallelism keeps well under Drive's per-user rate limits.
  for (let i = 0; i < ids.length; i += 4) {
    const results = await Promise.allSettled(ids.slice(i, i + 4).map((id) => getMediaFile(id)));
    results.forEach((r, j) => {
      if (r.status !== 'fulfilled') return;
      if (r.value) fresh.push(r.value);
      else gone.push(ids[i + j]);
    });
  }
  await upsertMedia(fresh);
  await deleteMedia(gone);
  if (fresh.length || gone.length) bump();
}

/** Remove items locally right away (e.g. after trashing them). */
export async function removeFromIndex(ids: string[]): Promise<void> {
  await deleteMedia(ids);
  bump();
}

/** Forget everything (sign-out / account switch). */
export async function resetIndex(): Promise<void> {
  // Let an in-flight sync finish first, or it could write rows back after the wipe.
  if (running) await running.catch(() => {});
  syncedThisSession = false;
  tried.clear();
  await clearIndex();
  status({ phase: 'idle', indexed: 0, ready: false, error: null });
  bump();
}
