/** Group media into day sections with human labels for the timeline. */
import type { MediaItem } from './types';

export type TimelineRow =
  | { type: 'header'; id: string; label: string; ts: number }
  | { type: 'item'; id: string; item: MediaItem };

/** "November 2024" — the fast-scroll date bubble label. */
export function monthLabel(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function groupByDay(items: MediaItem[]): TimelineRow[] {
  const sorted = [...items].sort((a, b) => b.takenAt - a.takenAt);
  const rows: TimelineRow[] = [];
  let currentKey = '';

  for (const item of sorted) {
    const key = dayKey(item.takenAt);
    if (key !== currentKey) {
      currentKey = key;
      rows.push({ type: 'header', id: `h-${key}`, label: dayLabel(item.takenAt), ts: item.takenAt });
    }
    rows.push({ type: 'item', id: item.id, item });
  }
  return rows;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';

  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: undefined,
    month: 'long',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
