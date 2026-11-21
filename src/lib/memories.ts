/**
 * "On this day" memories: photos taken on today's date in earlier years.
 * If no earlier year has photos on exactly today, falls back to this week
 * (±3 days) so the strip isn't empty most days.
 *
 * Each memory is an album with id `range:<startMs>-<endMs>` (local time), so
 * the album screen, viewer and slideshow work on it unchanged.
 */
import type { MediaItem } from './types';

export interface Memory {
  id: string;
  yearsAgo: number;
  /** "3 years ago" */
  title: string;
  /** "22 Nov 2023" or "This week in 2023" */
  subtitle: string;
  cover: MediaItem;
  count: number;
}

const DAY = 24 * 60 * 60 * 1000;
const WEEK_RADIUS_DAYS = 3;

export function rangeAlbumId(start: number, end: number): string {
  return `range:${start}-${end}`;
}

export function parseRangeAlbum(id: string): { start: number; end: number } | null {
  const m = /^range:(\d+)-(\d+)$/.exec(id);
  return m ? { start: Number(m[1]), end: Number(m[2]) } : null;
}

/** Local-midnight timestamp of `date` with its year replaced. */
function sameDateIn(year: number, now: Date): number {
  return new Date(year, now.getMonth(), now.getDate()).getTime();
}

export function buildMemories(items: MediaItem[], now = new Date()): Memory[] {
  const thisYear = now.getFullYear();
  const years = new Set<number>();
  for (const i of items) {
    const y = new Date(i.takenAt).getFullYear();
    if (y < thisYear && y > 1990) years.add(y);
  }

  const collect = (radiusDays: number) => {
    const out: Memory[] = [];
    for (const year of [...years].sort((a, b) => b - a)) {
      const mid = sameDateIn(year, now);
      const start = mid - radiusDays * DAY;
      const end = mid + (radiusDays + 1) * DAY;
      const inRange = items.filter((i) => i.takenAt >= start && i.takenAt < end);
      if (!inRange.length) continue;
      const yearsAgo = thisYear - year;
      out.push({
        id: rangeAlbumId(start, end),
        yearsAgo,
        title: `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago`,
        subtitle:
          radiusDays === 0
            ? new Date(mid).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
            : `This week in ${year}`,
        // Prefer a photo over a video for the cover.
        cover: inRange.find((i) => i.kind === 'photo') ?? inRange[0],
        count: inRange.length,
      });
    }
    return out;
  };

  const exact = collect(0);
  return exact.length ? exact : collect(WEEK_RADIUS_DAYS);
}

/** Title for a range album opened from a memory. */
export function rangeTitle(start: number, end: number, now = new Date()): string {
  const mid = new Date(start + (end - start) / 2);
  const yearsAgo = now.getFullYear() - mid.getFullYear();
  const when = end - start <= DAY ? mid.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : `This week in ${mid.getFullYear()}`;
  return yearsAgo > 0 ? `${when} · ${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago` : when;
}
