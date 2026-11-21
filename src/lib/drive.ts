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
const FIELDS =
  'nextPageToken, files(id,name,mimeType,size,createdTime,imageMediaMetadata(time,width,height),videoMediaMetadata(width,height,durationMillis),thumbnailLink,parents)';

const MAX_RETRIES = 4;

export class DriveAuthError extends Error {}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  thumbnailLink?: string;
  parents?: string[];
  imageMediaMetadata?: { time?: string; width?: number; height?: number };
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
}

async function driveFetch(path: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const token = await getValidAccessToken();
    if (!token) throw new DriveAuthError('Not authenticated');

    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });

    if (res.ok) return res;
    if (res.status === 401) throw new DriveAuthError('Token rejected');
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await delay(backoffMs(attempt, res.headers.get('Retry-After')));
      continue;
    }
    throw new Error(`Drive API ${res.status}: ${await safeText(res)}`);
  }
  throw new Error('Drive API: retries exhausted');
}

/** One page of media, newest first. Pass the previous nextPageToken to continue. */
export async function listMedia(pageToken?: string, pageSize = 200): Promise<Page<MediaItem>> {
  const params = new URLSearchParams({
    q: MEDIA_QUERY,
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

/** Move an item to Drive trash (recoverable). Requires write scope. */
export async function trashItem(id: string): Promise<void> {
  await driveFetch(`/files/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
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

function toMediaItem(f: DriveFile): MediaItem {
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
    thumbnailUrl: f.thumbnailLink,
    parents: f.parents,
  };
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

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '';
  }
}
