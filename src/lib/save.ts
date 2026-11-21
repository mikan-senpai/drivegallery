/**
 * Save Drive photos/videos into the phone's gallery (write-only access — the
 * app never reads your phone's photos). expo-media-library is required lazily
 * so builds without it show a clear message instead of crashing.
 */
import { downloadToCache } from './share';
import type { MediaItem } from './types';

export class SaveUnavailableError extends Error {
  constructor() {
    super('Saving to your phone needs the latest version of the app. Install the newest build and try again.');
  }
}
export class SavePermissionError extends Error {
  constructor() {
    super('Allow DriveGallery to add photos to your gallery (in Android settings) to save them.');
  }
}

type MediaLibrary = typeof import('expo-media-library');

function mediaLibrary(): MediaLibrary {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-media-library') as MediaLibrary;
  } catch {
    throw new SaveUnavailableError();
  }
}

/** Downloads the items and adds them to the phone's gallery. Returns how many were saved. */
export async function saveToPhone(items: MediaItem[], opts: { demo?: boolean } = {}): Promise<number> {
  if (items.length === 0) return 0;
  const ML = mediaLibrary();
  const perm = await ML.requestPermissionsAsync(true);
  if (!perm.granted) throw new SavePermissionError();
  const files = await downloadToCache(items, opts);
  for (const f of files) await ML.saveToLibraryAsync(f.uri);
  return files.length;
}
