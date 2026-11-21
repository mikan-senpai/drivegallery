/** Domain types shared across the Drive layer and UI. */

export interface MediaItem {
  id: string;
  name: string;
  mimeType: string;
  kind: 'photo' | 'video';
  sizeBytes?: number;
  /** Best-known capture/creation time, ms epoch. */
  takenAt: number;
  width?: number;
  height?: number;
  durationMs?: number;
  /** Grid-sized thumbnail. */
  thumbnailUrl?: string;
  /** Large preview for the full-screen viewer (falls back to thumbnailUrl). */
  previewUrl?: string;
  parents?: string[];
  favorite?: boolean;
  /** Drive's MD5 of the file contents — identical files share it (duplicate finder). */
  md5?: string;
  /** Photo GPS position, when the camera recorded one (places map). */
  lat?: number;
  lng?: number;
  /** e.g. "Galaxy S26 Ultra" (search filter). */
  camera?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  count: number;
  coverThumbnailUrl?: string;
}

export interface Page<T> {
  items: T[];
  nextPageToken?: string;
}

export interface GoogleTokens {
  accessToken: string;
  /** ms epoch when accessToken expires. */
  expiresAt: number;
  idToken?: string;
  email?: string;
}
