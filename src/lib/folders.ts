/**
 * Drive folder tree + include/exclude resolution.
 *
 * Model — "nearest rule wins": a folder takes the state of the closest folder
 * on its path (itself first, then parents) that the user explicitly included
 * or excluded. So you can include "Trips", exclude "Trips/Work", and re-include
 * "Trips/Work/Offsite". With nothing included, the whole Drive is in scope
 * (minus exclusions).
 *
 * Drive search can only match direct parents, so the app loads the folder
 * tree once and resolves the full set of folders to query itself.
 */
import { driveFetchJson } from './drive';

export interface DriveFolderNode {
  id: string;
  name: string;
  parent?: string;
}

export interface FolderIndex {
  rootId: string;
  byId: Map<string, DriveFolderNode>;
  children: Map<string, DriveFolderNode[]>;
}

export interface FolderSelection {
  include: string[];
  exclude: string[];
}

export type FolderState =
  | 'included' // explicitly included
  | 'excluded' // explicitly excluded
  | 'inheritedIncluded' // in scope via a parent, or whole-Drive mode
  | 'inheritedExcluded' // out of scope via an excluded parent
  | 'none'; // not in scope (some folders are included, this isn't under any)

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/**
 * Virtual folder holding every folder whose parent isn't visible from My Drive —
 * "Shared with me", Drive-for-desktop "Computers" backups, folders whose parent
 * you can't access. Without it those folders have no path to My Drive, so they
 * can't be browsed in the Folders screen or hidden through a parent.
 */
export const OTHER_LOCATIONS_ID = '__other_locations__';

/** Load every folder the user owns or can see in My Drive, plus the root id. */
export async function loadFolderIndex(): Promise<FolderIndex> {
  const root = await driveFetchJson<{ id: string }>('/files/root?fields=id');
  const byId = new Map<string, DriveFolderNode>();
  byId.set(root.id, { id: root.id, name: 'My Drive' });

  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: 'nextPageToken, files(id,name,parents)',
      pageSize: '1000',
      spaces: 'drive',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const page = await driveFetchJson<{
      files?: { id: string; name: string; parents?: string[] }[];
      nextPageToken?: string;
    }>(`/files?${params.toString()}`);
    for (const f of page.files ?? []) byId.set(f.id, { id: f.id, name: f.name, parent: f.parents?.[0] });
    pageToken = page.nextPageToken;
  } while (pageToken);

  // Re-home folders that can't reach My Drive under the virtual "other locations" folder.
  const orphans = [...byId.values()].filter((n) => n.id !== root.id && (!n.parent || !byId.has(n.parent)));
  if (orphans.length) {
    byId.set(OTHER_LOCATIONS_ID, { id: OTHER_LOCATIONS_ID, name: 'Shared & other locations', parent: root.id });
    for (const n of orphans) n.parent = OTHER_LOCATIONS_ID;
  }

  const children = new Map<string, DriveFolderNode[]>();
  for (const node of byId.values()) {
    if (!node.parent) continue;
    const list = children.get(node.parent) ?? [];
    list.push(node);
    children.set(node.parent, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  // Keep the virtual folder last in My Drive's listing rather than sorted among real folders.
  const top = children.get(root.id);
  const other = top?.findIndex((n) => n.id === OTHER_LOCATIONS_ID) ?? -1;
  if (top && other >= 0) top.push(...top.splice(other, 1));

  return { rootId: root.id, byId, children };
}

/** Effective state of a folder under the nearest-rule-wins model. */
export function folderState(id: string, sel: FolderSelection, index: FolderIndex): FolderState {
  const include = new Set(sel.include);
  const exclude = new Set(sel.exclude);
  if (include.has(id)) return 'included';
  if (exclude.has(id)) return 'excluded';

  let cur = index.byId.get(id)?.parent;
  for (let depth = 0; cur && depth < 64; depth++) {
    if (include.has(cur)) return 'inheritedIncluded';
    if (exclude.has(cur)) return 'inheritedExcluded';
    cur = index.byId.get(cur)?.parent;
  }
  return sel.include.length === 0 ? 'inheritedIncluded' : 'none';
}

export const isInScope = (s: FolderState) => s === 'included' || s === 'inheritedIncluded';

/** What tapping a folder's control does, given its current state. */
export function toggleFor(state: FolderState): { list: 'include' | 'exclude'; add: boolean } {
  switch (state) {
    case 'included':
      return { list: 'include', add: false };
    case 'excluded':
      return { list: 'exclude', add: false };
    case 'inheritedIncluded':
      return { list: 'exclude', add: true };
    default:
      // 'inheritedExcluded' re-includes inside an excluded folder; 'none' includes.
      return { list: 'include', add: true };
  }
}

/**
 * Resolve the selection into what to ask Drive for:
 *  - `{ mode: 'all' }` — whole Drive, nothing excluded
 *  - `{ mode: 'allExcept', allowed }` — whole Drive, filter out excluded folders client-side
 *  - `{ mode: 'folders', allowed }` — query only these folders
 */
export type MediaScope =
  | { mode: 'all' }
  | { mode: 'allExcept'; allowed: Set<string> }
  | { mode: 'folders'; allowed: string[] };

export function resolveScope(sel: FolderSelection, index: FolderIndex | undefined): MediaScope {
  if (sel.include.length === 0 && sel.exclude.length === 0) return { mode: 'all' };
  if (!index) return { mode: 'all' }; // tree not loaded yet

  const allowed = new Set<string>();
  for (const id of index.byId.keys()) {
    if (isInScope(folderState(id, sel, index))) allowed.add(id);
  }
  return sel.include.length === 0 ? { mode: 'allExcept', allowed } : { mode: 'folders', allowed: [...allowed] };
}

/** Breadcrumb path from root to a folder, e.g. ["My Drive", "Trips", "Goa"]. */
export function pathOf(id: string, index: FolderIndex): DriveFolderNode[] {
  const path: DriveFolderNode[] = [];
  let cur: string | undefined = id;
  for (let depth = 0; cur && depth < 64; depth++) {
    const node = index.byId.get(cur);
    if (!node) break;
    path.unshift(node);
    cur = node.parent;
  }
  return path;
}
