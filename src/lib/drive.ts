/**
 * Google Drive REST v3 client — read-only media access.
 *
 * Responsibilities:
 *  - List image/video files with pagination.
 *  - Normalize Drive metadata into MediaItem (EXIF date with createdTime fallback).
 *  - Exponential backoff on 429/5xx; auth refresh on 401.
 *  - Expose folders and trash (write) actions.
 *
 * All network calls flow through `driveFetch`, which injects the bearer token
 * and retries transient failures.
 */
import { getValidAccessToken } from './auth';
import type { DriveFolder, MediaItem, Page } from './types';

const API = 'https://www.googleapis.com/drive/v3';
const MEDIA_QUERY =
  "(mimeType contains 'image/' or mimeType contains 'video/') and trashed = false";
/** Per-file fields the app needs (shared by files.list, files.get and changes.list). */
const FILE_FIELDS =
  'id,name,mimeType,size,createdTime,imageMediaMetadata(time,width,height),videoMediaMetadata(width,height,durationMillis),thumbnailLink,parents,trashed';
const FIELDS = `nextPageToken, files(${FILE_FIELDS})`;

const MAX_RETRIES = 4;

export class DriveAuthError extends Error {}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  trashed?: boolean;
  size?: string;
  createdTime?: string;
  thumbnailLink?: string;
  parents?: string[];
  imageMediaMetadata?: { time?: string; width?: number; height?: number };
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
}

async function driveFetch(path: string, init?: RequestInit): Promise<Response> {
  let refreshed = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const token = await getValidAccessToken(refreshed);
    if (!token) throw new DriveAuthError('Not authenticated');

    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });

    if (res.ok) return res;
    if (res.status === 401) {
      // Token expired or revoked server-side: refresh once, then give up.
      if (refreshed) throw new DriveAuthError('Token rejected');
      refreshed = true;
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await delay(backoffMs(attempt, res.headers.get('Retry-After')));
      continue;
    }
    throw new Error(await errorMessage(res));
  }
  throw new Error('Drive API: retries exhausted');
}

/** GET a Drive endpoint and parse JSON (auth, retries and errors handled). */
export async function driveFetchJson<T>(path: string): Promise<T> {
  const res = await driveFetch(path);
  return (await res.json()) as T;
}

/**
 * One page of media, newest first. Pass the previous nextPageToken to continue.
 * With `folderIds`, only media directly inside those folders (callers pass the
 * fully resolved folder set, since Drive can't search subfolders itself).
 */
export async function listMedia(pageToken?: string, pageSize = 200, folderIds?: string[]): Promise<Page<MediaItem>> {
  const scope = folderIds?.length ? ` and (${folderIds.map((id) => `'${id}' in parents`).join(' or ')})` : '';
  const params = new URLSearchParams({
    q: MEDIA_QUERY + scope,
    fields: FIELDS,
    pageSize: String(pageSize),
    orderBy: 'createdTime desc',
    spaces: 'drive',
  });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await driveFetch(`/files?${params.toString()}`);
  const json = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
  return {
    items: (json.files ?? []).map(toMediaItem),
    nextPageToken: json.nextPageToken,
  };
}

/** Authenticated full-resolution media URL for the viewer. */
export function mediaUrl(id: string): string {
  return `${API}/files/${id}?alt=media`;
}

/** Headers for fetching `mediaUrl` / thumbnails that require auth. */
export async function authHeader(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  if (!token) throw new DriveAuthError('Not authenticated');
  return { Authorization: `Bearer ${token}` };
}

// ---- Changes API (incremental sync for the offline index) ----

/** Token marking "now" in the user's change feed. Store it, then ask for changes since. */
export async function getStartPageToken(): Promise<string> {
  const json = await driveFetchJson<{ startPageToken: string }>('/changes/startPageToken');
  return json.startPageToken;
}

export interface DriveChange {
  fileId: string;
  removed?: boolean;
  file?: DriveFile;
}

/** One page of changes since `pageToken`. The last page carries `newStartPageToken`. */
export async function listChanges(
  pageToken: string
): Promise<{ changes: DriveChange[]; nextPageToken?: string; newStartPageToken?: string }> {
  const params = new URLSearchParams({
    pageToken,
    pageSize: '1000',
    includeRemoved: 'true',
    spaces: 'drive',
    fields: `nextPageToken, newStartPageToken, changes(fileId, removed, file(${FILE_FIELDS}))`,
  });
  const json = await driveFetchJson<{
    changes?: DriveChange[];
    nextPageToken?: string;
    newStartPageToken?: string;
  }>(`/changes?${params.toString()}`);
  return { changes: json.changes ?? [], nextPageToken: json.nextPageToken, newStartPageToken: json.newStartPageToken };
}

/** Fresh metadata for one file (e.g. to renew an expired thumbnail link). */
export async function getMediaFile(id: string): Promise<MediaItem | null> {
  const f = await driveFetchJson<DriveFile>(`/files/${id}?fields=${encodeURIComponent(FILE_FIELDS)}`);
  return f.trashed || !isMediaFile(f) ? null : toMediaItem(f);
}

/** Move an item to Drive trash (recoverable). Requires write scope. */
export async function trashItem(id: string): Promise<void> {
  await driveFetch(`/files/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

const folderCache = new Map<string, { name: string; parent?: string }>();

/**
 * Human-readable location of a file, e.g. "My Drive / WhatsApp / Video".
 * Walks parent folders up to the root (cached). Files with no parent are
 * ones shared with the user rather than stored in their Drive.
 */
export async function getFolderPath(parents?: string[]): Promise<string> {
  if (!parents?.length) return 'Shared with me';
  const names: string[] = [];
  let id: string | undefined = parents[0];

  for (let depth = 0; id && depth < 12; depth++) {
    let folder = folderCache.get(id);
    if (!folder) {
      const res = await driveFetch(`/files/${id}?fields=name,parents`);
      const json = (await res.json()) as { name: string; parents?: string[] };
      folder = { name: json.name, parent: json.parents?.[0] };
      folderCache.set(id, folder);
    }
    names.unshift(folder.name);
    id = folder.parent;
  }
  return names.join(' / ');
}

/** Folders that directly contain media, with counts (best-effort, MVP). */
export async function listFolders(): Promise<DriveFolder[]> {
  const params = new URLSearchParams({
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id,name)',
    pageSize: '200',
  });
  const res = await driveFetch(`/files?${params.toString()}`);
  const json = (await res.json()) as { files?: { id: string; name: string }[] };
  return (json.files ?? []).map((f) => ({ id: f.id, name: f.name, count: 0 }));
}

// --- helpers ---

export function isMediaFile(f: Pick<DriveFile, 'mimeType'>): boolean {
  return f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/');
}

export function toMediaItem(f: DriveFile): MediaItem {
  const isVideo = f.mimeType.startsWith('video/');
  const takenAtRaw = f.imageMediaMetadata?.time ?? f.createdTime;
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    kind: isVideo ? 'video' : 'photo',
    sizeBytes: f.size ? Number(f.size) : undefined,
    takenAt: parseTime(takenAtRaw),
    width: f.imageMediaMetadata?.width ?? f.videoMediaMetadata?.width,
    height: f.imageMediaMetadata?.height ?? f.videoMediaMetadata?.height,
    durationMs: f.videoMediaMetadata?.durationMillis
      ? Number(f.videoMediaMetadata.durationMillis)
      : undefined,
    thumbnailUrl: sized(f.thumbnailLink, 600),
    previewUrl: sized(f.thumbnailLink, 2048),
    parents: f.parents,
  };
}

/** Drive thumbnail links end in `=s220`; swap in a larger size for sharp tiles / full view. */
function sized(link: string | undefined, px: number): string | undefined {
  if (!link) return undefined;
  return /=s\d+$/.test(link) ? link.replace(/=s\d+$/, `=s${px}`) : `${link}=s${px}`;
}

/** EXIF time is "YYYY:MM:DD HH:MM:SS"; createdTime is ISO 8601. */
function parseTime(raw?: string): number {
  if (!raw) return 0;
  const exif = /^(\d{4}):(\d{2}):(\d{2}) (.+)$/.exec(raw);
  const iso = exif ? `${exif[1]}-${exif[2]}-${exif[3]}T${exif[4]}` : raw;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (!Number.isNaN(secs)) return secs * 1000;
  }
  const base = 2 ** attempt * 400;
  return base + Math.random() * 300; // full jitter
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Google API errors are JSON `{ error: { message } }`; surface just the human message. */
async function errorMessage(res: Response): Promise<string> {
  let body = '';
  try {
    body = await res.text();
    const message = (JSON.parse(body) as { error?: { message?: string } }).error?.message;
    if (message) return message;
  } catch {
    // Not JSON — fall through to the raw text.
  }
  return `Drive request failed (${res.status})${body ? `: ${body.slice(0, 160)}` : ''}`;
}
