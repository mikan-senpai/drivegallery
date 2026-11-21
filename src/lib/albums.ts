/**
 * Albums = smart albums (Favorites, Videos) + one album per Drive folder that
 * directly contains media. Album ids: 'favorites', 'videos', or a Drive folder id.
 */
import type { FolderIndex } from './folders';
import type { MediaItem } from './types';

export const FAVORITES_ALBUM = 'favorites';
export const VIDEOS_ALBUM = 'videos';

export interface FolderAlbum {
  id: string;
  name: string;
  /** e.g. "My Drive / Trips" — the folder's parent path, for disambiguation. */
  location: string;
  count: number;
  cover?: MediaItem;
  latest: number;
}

/** Items in an album, in the order given (newest first from the timeline). */
export function itemsInAlbum(items: MediaItem[], albumId: string, favorites: Record<string, true>): MediaItem[] {
  if (albumId === FAVORITES_ALBUM) return items.filter((i) => favorites[i.id]);
  if (albumId === VIDEOS_ALBUM) return items.filter((i) => i.kind === 'video');
  return items.filter((i) => i.parents?.[0] === albumId);
}

/** Group media by parent folder, newest-active folders first. */
export function buildFolderAlbums(items: MediaItem[], index: FolderIndex | undefined): FolderAlbum[] {
  const byFolder = new Map<string, FolderAlbum>();
  for (const item of items) {
    const folderId = item.parents?.[0];
    if (!folderId) continue;
    let album = byFolder.get(folderId);
    if (!album) {
      const node = index?.byId.get(folderId);
      album = {
        id: folderId,
        name: node?.name ?? 'Shared with me',
        location: node ? parentPath(folderId, index!) : '',
        count: 0,
        latest: 0,
      };
      byFolder.set(folderId, album);
    }
    album.count++;
    if (item.takenAt > album.latest) {
      album.latest = item.takenAt;
      album.cover = item;
    }
  }
  return [...byFolder.values()].sort((a, b) => b.latest - a.latest);
}

function parentPath(folderId: string, index: FolderIndex): string {
  const names: string[] = [];
  let cur = index.byId.get(folderId)?.parent;
  for (let depth = 0; cur && depth < 64; depth++) {
    const node = index.byId.get(cur);
    if (!node) break;
    names.unshift(node.name);
    cur = node.parent;
  }
  return names.join(' / ');
}

export function albumTitle(albumId: string, index: FolderIndex | undefined): string {
  if (albumId === FAVORITES_ALBUM) return 'Favorites';
  if (albumId === VIDEOS_ALBUM) return 'Videos';
  return index?.byId.get(albumId)?.name ?? 'Album';
}
