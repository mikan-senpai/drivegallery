# DriveGallery — PRD

**Summary:** A read-only, Google Photos–style mobile gallery (React Native / Expo, iOS + Android) that indexes the images and videos in a user's Google Drive and presents them as a date-grouped timeline. Files stay in Drive; the app never uploads or copies originals.

## Goals
- Browse all Drive media as a fast, familiar photo grid.
- Zero data duplication — Drive remains the source of truth.
- Work offline for anything already viewed (thumbnail cache).

## Non-goals
- Not a backup/upload tool. Not an editor. Not a Drive file manager (docs, sheets).
- No server backend in MVP — client talks to Google APIs directly.
- No cross-cloud (Dropbox/iCloud) in MVP.

## Target users
- People whose photos already live in Google Drive (not Google Photos) and lack a gallery UX.
- Users who want a clean viewer without migrating or re-uploading files.

## Phases
- **MVP (P0):** OAuth connect, media index, timeline, full-screen viewer (swipe/zoom), folders view, thumbnail cache, settings/disconnect.
- **P1:** Albums (Drive folders as albums + app-side favorites), search, video playback, remove-from-Drive (trash).
- **P2:** Shared-drive support, on-device face/scene grouping, multi-account, selection + bulk actions, share links.

---

## Features (user stories + acceptance criteria)

### 1. Connect (OAuth, read-only)
As a user, I connect my Google account so the app can read my Drive media.
- Uses scope `drive.readonly` only; consent screen states read-only.
- Token stored in secure storage (Keychain / Keystore); silent refresh on launch.
- Failure/cancel returns to connect screen with a retry; no crash.

### 2. Media indexing
As a user, my Drive images/videos appear without my organizing anything.
- Query Drive for `mimeType contains 'image/' or 'video/'`, `trashed=false`.
- Paginates full library; shows incremental progress; resumable if interrupted.
- Index persisted locally (SQLite); subsequent launches sync deltas, not full re-scan.

### 3. Timeline
As a user, I see photos newest-first, grouped by day/month.
- Sort by capture date (EXIF) falling back to Drive `createdTime`.
- Sticky date headers; smooth scroll over large libraries (virtualized grid).
- Pull-to-refresh triggers delta sync.

### 4. Albums / Folders
As a user, I browse by Drive folder and by favorites.
- Folders view lists Drive folders containing media, with cover thumbnail + count.
- Favorites = app-side flag (local), shown as a virtual album.

### 5. Search
As a user, I find photos by name/date/type.
- Filters: filename text, date range, type (photo/video). MVP = local index search.
- Empty state names what's searchable.

### 6. Full-screen viewer
As a user, I open a photo full-screen and interact with it.
- Swipe left/right between items; pinch-zoom + double-tap zoom; swipe-down to dismiss.
- Actions: Favorite (local), Share (native sheet via Drive link or downloaded temp file), Info (name, size, date, resolution, Drive path), Remove.
- Loads full-res via `webContentLink`/media endpoint; shows cached thumbnail first.
- Video items play inline with standard controls.

### 7. Remove from Drive
As a user, I can remove a photo and it leaves Drive.
- Default = move to Drive trash (`trashed=true`), recoverable; confirm dialog states "moves to Google Drive Trash."
- Requires write scope (`drive.file` or `drive`) — gated behind a separate, explicit permission upgrade; omitted entirely if user stays read-only.

### 8. Offline thumbnail cache
As a user, previously seen photos load instantly and offline.
- Thumbnails fetched from `thumbnailLink`, stored via Expo FileSystem, LRU-capped (configurable, e.g. 500 MB).
- Cache keyed by fileId + modifiedTime; invalidated on change.

### 9. Settings / revoke
As a user, I control access and storage.
- Theme toggle (Paper / Twilight / System), cache size + clear, account email, Disconnect.
- Disconnect revokes token server-side and wipes local index + cache.

---

## Google Drive integration

- **Scopes:** `drive.readonly` (MVP). Write actions (remove) need `drive.file`/`drive` — request only on demand.
- **List query:** `files.list` with `q=(mimeType contains 'image/' or mimeType contains 'video/') and trashed=false`, `fields=nextPageToken, files(id,name,mimeType,size,createdTime,modifiedTime,imageMediaMetadata,videoMediaMetadata,thumbnailLink,webContentLink,parents)`, `pageSize=1000`, `orderBy=createdTime desc`.
- **Pagination:** loop on `nextPageToken`; persist token for resume.
- **thumbnailLink vs webContentLink:** `thumbnailLink` = short-lived, resize via `=s<size>` param — use for grid. `webContentLink`/`files.get?alt=media` = full original — use in viewer, fetch with auth header.
- **EXIF/date:** prefer `imageMediaMetadata.time` (and `videoMediaMetadata`); fallback `createdTime`. Normalize to local tz for grouping.
- **Delta sync:** use Drive **Changes API** (`changes.list` + `startPageToken`) to sync adds/edits/deletes instead of re-listing.
- **Quotas/limits:** per-user rate limits apply — batch, back off exponentially on 403/429, cache aggressively. `thumbnailLink` URLs expire (~hours) so re-fetch via index, don't persist URLs.
- **Caching:** SQLite for metadata index; FileSystem LRU for thumbnails; full-res not persisted (streamed + temp).

## Tech stack
- **Framework:** Expo (React Native), TypeScript, Expo Router.
- **Auth:** `@react-native-google-signin/google-signin` or `expo-auth-session` (PKCE) for Drive scopes.
- **API:** Drive REST v3 over fetch; typed client.
- **Storage:** `expo-sqlite` (index), `expo-file-system` (thumbnails), `expo-secure-store` (tokens).
- **UI:** virtualized grid (`FlashList`), `expo-image` (caching/zoom), `react-native-reanimated` + gesture-handler (viewer), `expo-video`.
- **State:** Zustand (UI/session) + TanStack Query (API/cache sync).
- **Theming:** token-based Paper/Twilight (Lora + Outfit, squircle, floating blur tab bar).

## Risks / open questions
- **Drive isn't photo-first:** no capture-date index server-side → client-side sort can be slow on huge libraries. Mitigate with SQLite index + incremental load.
- **thumbnailLink expiry + rate limits** could make first-run slow; need tuned prefetch + backoff.
- **Google verification:** restricted-scope OAuth app requires Google security review before public release — plan lead time.
- **Remove = trash vs delete:** default to trash; confirm UX. Does user want write scope at all?
- **Large videos:** streaming full-res over mobile data — add Wi-Fi-only / quality setting?
- **Shared drives / shortcuts:** include in index? (Deferred to P2.)

## Success metrics
- Time-to-first-grid after connect < 5s (cached), < 30s first full index (10k items).
- Thumbnail cache hit rate > 90% on repeat sessions.
- Scroll ≥ 55 fps on mid-tier device over 10k-item timeline.
- Crash-free sessions > 99.5%.
- D7 retention / weekly active opens as north-star engagement.
