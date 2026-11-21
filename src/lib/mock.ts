/**
 * Demo data so the UI runs in Expo Go without a native Google Sign-In build.
 * Toggled by `session.demoMode`. Remove once real auth + indexing are wired.
 */
import type { MediaItem } from './types';

const DAY = 24 * 60 * 60 * 1000;

export function mockMedia(count = 48): MediaItem[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const kind: MediaItem['kind'] = i % 7 === 3 ? 'video' : 'photo';
    return {
      id: `demo-${i}`,
      name: `${kind === 'video' ? 'VID' : 'IMG'}_${1000 + i}.${kind === 'video' ? 'mp4' : 'jpg'}`,
      mimeType: kind === 'video' ? 'video/mp4' : 'image/jpeg',
      kind,
      sizeBytes: 1_500_000 + i * 90_000,
      takenAt: now - Math.floor(i / 6) * DAY - i * 37 * 60 * 1000,
      width: 1600,
      height: 1200,
      durationMs: kind === 'video' ? 14_000 : undefined,
      thumbnailUrl: `https://picsum.photos/seed/dg${i}/500/500`,
      favorite: i % 11 === 0,
    };
  });
}
