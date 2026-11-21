/**
 * Share Drive media through the system share sheet.
 *
 * Drive files aren't on the device, so each one is downloaded (with the auth
 * header) into the cache, then handed to react-native-share — which, unlike
 * expo-sharing, can share several files in one go.
 *
 * The native module is required lazily so older builds without it show a
 * clear message instead of crashing at import time.
 */
import { File, Directory, Paths } from 'expo-file-system';
import { authHeader, mediaUrl } from './drive';
import type { MediaItem } from './types';

export class ShareUnavailableError extends Error {
  constructor() {
    super('Sharing needs the latest version of the app. Install the newest build and try again.');
  }
}

type ShareModule = typeof import('react-native-share').default;

function shareModule(): ShareModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('react-native-share') as { default: ShareModule }).default;
  } catch {
    throw new ShareUnavailableError();
  }
}

/** Download the items to the cache and open the share sheet. Resolves when the sheet closes. */
export async function shareMedia(items: MediaItem[], opts: { demo?: boolean } = {}): Promise<void> {
  if (items.length === 0) return;
  const Share = shareModule();

  const dir = new Directory(Paths.cache, 'share');
  if (!dir.exists) dir.create({ intermediates: true });

  const headers = opts.demo ? undefined : await authHeader();
  const files = await Promise.all(
    items.map((item) => {
      const url = opts.demo ? (item.thumbnailUrl ?? '') : mediaUrl(item.id);
      const target = new File(dir, safeName(item));
      return File.downloadFileAsync(url, target, { headers, idempotent: true });
    })
  );

  const kinds = new Set(items.map((i) => i.kind));
  const type = kinds.size > 1 ? '*/*' : kinds.has('video') ? 'video/*' : 'image/*';

  await Share.open({ urls: files.map((f) => f.uri), type, failOnCancel: false });
}

/** File name that's safe on disk and keeps the original extension. */
function safeName(item: MediaItem): string {
  const cleaned = item.name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || `${item.id}.${item.kind === 'video' ? 'mp4' : 'jpg'}`;
}
