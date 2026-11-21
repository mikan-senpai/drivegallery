/**
 * Offline media index (SQLite).
 *
 * Schema:
 *   media(id PK, name, mime, kind, size, taken_at, width, height, duration_ms,
 *         thumb, parent, md5, lat, lng, camera)
 *                                 — one row per Drive image/video
 *     indexes: taken_at DESC (timeline order), parent (folder scoping), md5 (duplicates)
 *   meta(key PK, value)          — sync bookkeeping:
 *     changes_token    Drive Changes API cursor for delta sync
 *     full_sync_done   '1' once the first full scan completed
 *     full_sync_page   resume point if the first scan was interrupted
 *     full_sync_start  change-feed token captured *before* the first scan
 *     thumbs_at        last time thumbnail links were refreshed (ms)
 */
import * as SQLite from 'expo-sqlite';
import type { MediaScope } from './folders';
import type { MediaItem } from './types';

const DB_NAME = 'drivegallery.db';
const SCHEMA_VERSION = 2;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const conn = await SQLite.openDatabaseAsync(DB_NAME);
  await conn.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      kind TEXT NOT NULL,
      size INTEGER,
      taken_at INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      duration_ms INTEGER,
      thumb TEXT,
      parent TEXT,
      md5 TEXT,
      lat REAL,
      lng REAL,
      camera TEXT
    );
    CREATE INDEX IF NOT EXISTS media_taken ON media(taken_at DESC);
    CREATE INDEX IF NOT EXISTS media_parent ON media(parent);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT);
  `);
  const row = await conn.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const version = row?.user_version ?? 0;
  if (version < 2) await migrateToV2(conn);
  if (version < SCHEMA_VERSION) await conn.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  await conn.execAsync('CREATE INDEX IF NOT EXISTS media_md5 ON media(md5)');
  return conn;
}

/**
 * v2 adds md5 / GPS / camera. Existing installs get the columns, then one full
 * re-scan (rows stay visible meanwhile) so already-indexed photos gain the data.
 */
async function migrateToV2(conn: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await conn.getAllAsync<{ name: string }>('PRAGMA table_info(media)', []);
  const have = new Set(cols.map((c) => c.name));
  for (const [name, sqlType] of [
    ['md5', 'TEXT'],
    ['lat', 'REAL'],
    ['lng', 'REAL'],
    ['camera', 'TEXT'],
  ] as const) {
    if (!have.has(name)) await conn.execAsync(`ALTER TABLE media ADD COLUMN ${name} ${sqlType}`);
  }
  await conn.execAsync(
    "DELETE FROM meta WHERE key IN ('full_sync_done', 'full_sync_page', 'full_sync_start', 'thumbs_at')"
  );
}

interface Row {
  id: string;
  name: string;
  mime: string;
  kind: string;
  size: number | null;
  taken_at: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  thumb: string | null;
  parent: string | null;
  md5: string | null;
  lat: number | null;
  lng: number | null;
  camera: string | null;
}

/** Same rewrite as drive.ts: Drive thumbnail links end in `=s220`. */
const sized = (link: string | null, px: number) => (link ? link.replace(/=s\d+$/, '') + `=s${px}` : undefined);

function toItem(r: Row): MediaItem {
  return {
    id: r.id,
    name: r.name,
    mimeType: r.mime,
    kind: r.kind === 'video' ? 'video' : 'photo',
    sizeBytes: r.size ?? undefined,
    takenAt: r.taken_at,
    width: r.width ?? undefined,
    height: r.height ?? undefined,
    durationMs: r.duration_ms ?? undefined,
    thumbnailUrl: sized(r.thumb, 600),
    previewUrl: sized(r.thumb, 2048),
    parents: r.parent ? [r.parent] : undefined,
    md5: r.md5 ?? undefined,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    camera: r.camera ?? undefined,
  };
}

/** Store the bare Drive link (strip our size suffix) so sizes can be re-derived. */
const bareThumb = (url?: string) => (url ? url.replace(/=s\d+$/, '') : null);

export async function upsertMedia(items: MediaItem[]): Promise<void> {
  if (items.length === 0) return;
  const conn = await db();
  await conn.withExclusiveTransactionAsync(async (txn) => {
    const stmt = await txn.prepareAsync(
      `INSERT INTO media (id, name, mime, kind, size, taken_at, width, height, duration_ms, thumb, parent, md5, lat, lng, camera)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, mime = excluded.mime, kind = excluded.kind, size = excluded.size,
         taken_at = excluded.taken_at, width = excluded.width, height = excluded.height,
         duration_ms = excluded.duration_ms, thumb = excluded.thumb, parent = excluded.parent,
         md5 = excluded.md5, lat = excluded.lat, lng = excluded.lng, camera = excluded.camera`
    );
    try {
      for (const i of items) {
        await stmt.executeAsync([
          i.id,
          i.name,
          i.mimeType,
          i.kind,
          i.sizeBytes ?? null,
          i.takenAt,
          i.width ?? null,
          i.height ?? null,
          i.durationMs ?? null,
          bareThumb(i.thumbnailUrl),
          i.parents?.[0] ?? null,
          i.md5 ?? null,
          i.lat ?? null,
          i.lng ?? null,
          i.camera ?? null,
        ]);
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
}

export async function deleteMedia(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const conn = await db();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    await conn.runAsync(`DELETE FROM media WHERE id IN (${chunk.map(() => '?').join(',')})`, chunk);
  }
}

/** All indexed media in the given folder scope, newest first. */
export async function queryMedia(scope: MediaScope, excludedFolders: string[] = []): Promise<MediaItem[]> {
  const conn = await db();
  let rows: Row[];
  if (scope.mode === 'folders') {
    if (scope.allowed.length === 0) return [];
    rows = await conn.getAllAsync<Row>(
      `SELECT * FROM media WHERE parent IN (${scope.allowed.map(() => '?').join(',')}) ORDER BY taken_at DESC`,
      scope.allowed
    );
  } else if (scope.mode === 'allExcept' && excludedFolders.length > 0) {
    rows = await conn.getAllAsync<Row>(
      `SELECT * FROM media WHERE parent IS NULL OR parent NOT IN (${excludedFolders.map(() => '?').join(',')})
       ORDER BY taken_at DESC`,
      excludedFolders
    );
  } else {
    rows = await conn.getAllAsync<Row>('SELECT * FROM media ORDER BY taken_at DESC', []);
  }
  return rows.map(toItem);
}

export async function countMedia(): Promise<number> {
  const conn = await db();
  const row = await conn.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM media', []);
  return row?.n ?? 0;
}

export async function allMediaIds(): Promise<string[]> {
  const conn = await db();
  const rows = await conn.getAllAsync<{ id: string }>('SELECT id FROM media', []);
  return rows.map((r) => r.id);
}

export async function getMeta(key: string): Promise<string | null> {
  const conn = await db();
  const row = await conn.getFirstAsync<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string | null): Promise<void> {
  const conn = await db();
  if (value === null) await conn.runAsync('DELETE FROM meta WHERE key = ?', [key]);
  else await conn.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

/** Wipe the index (sign-out / account switch). */
export async function clearIndex(): Promise<void> {
  const conn = await db();
  await conn.execAsync('DELETE FROM media; DELETE FROM meta;');
}
