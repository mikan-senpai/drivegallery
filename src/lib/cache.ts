/** Local caches: expo-image thumbnails (memory + disk) and files downloaded for sharing. */
import { Image } from 'expo-image';
import { Directory, Paths } from 'expo-file-system';

/** Clears thumbnail + share caches. Returns bytes freed from the share cache (thumbnail size isn't exposed). */
export async function clearMediaCaches(): Promise<number> {
  const shareDir = new Directory(Paths.cache, 'share');
  let freed = 0;
  if (shareDir.exists) {
    freed = shareDir.size ?? 0;
    shareDir.delete();
  }
  await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
  return freed;
}
