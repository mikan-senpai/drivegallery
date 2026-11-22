# DriveGallery — handoff

Read this first if you're picking the project up later. It records what the app is, how it's built and shipped, what happened along the way, and exactly where things stand.

**Last updated:** 2026-11-22 · **Latest release:** v0.1.1 (tag on `feat/frost-glass-variant`, see Status)

---

## 1. What it is

A Google Photos / Samsung Gallery–style app for the photos and videos **already in your Google Drive**. It is a viewer: originals never leave Drive. An on-device SQLite index makes it open instantly and scroll the whole library.

- Platforms: Android (shipped as an APK on GitHub Releases). iOS builds are possible but never shipped.
- Design: "Twilight Stillness". Lora (serif headlines) + Outfit (body). Two themes, **Paper** (light) and **Twilight** (dark). A floating liquid/frosted-glass tab bar.
- Audience: the owner and friends. Sign-in works only for Gmail accounts on the Google Cloud OAuth **test-user list** (the app is not verified by Google).

## 2. Identifiers (no secrets here)

| Thing | Value |
|---|---|
| GitHub repo | `mikan-senpai/drivegallery` (public) |
| Android package / iOS bundle | `com.mikansenpai.drivegallery` |
| Expo account / project | owner `mikanadhi`, slug `drive-gallery`, project id `7a676522-ce56-4583-a396-eb46ee646d0d` |
| EAS Update URL | `https://u.expo.dev/7a676522-ce56-4583-a396-eb46ee646d0d` |
| URL scheme | `drivegallery` |
| Google OAuth client | env var `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (in local `.env` and as an EAS environment variable) |
| CI secret | `EXPO_TOKEN` (GitHub repo secret, used by the release workflow) |

Google scopes: `drive.readonly` + `drive.appdata` at sign-in. Full `drive` is requested incrementally only when the user first moves something to Trash. `drive.appdata` must also be listed under Google Cloud → OAuth consent → Data access.

## 3. Stack

Expo SDK 58 · React Native 0.88 (New Architecture) · React 19.3 + React Compiler · expo-router (typed routes) · TypeScript strict · Reanimated 4.7 + react-native-worklets 0.13 · react-native-gesture-handler 3.3 · FlashList 2 · expo-image · expo-sqlite · zustand (persisted to AsyncStorage) · @react-native-google-signin v13 · expo-video · expo-blur.

Native modules that may be missing in older builds are loaded lazily with `require` in try/catch: local-authentication, media-library, react-native-webview, keep-awake, react-native-share. The app then shows "needs the latest version" instead of crashing.

## 4. Code map

```
app/
  _layout.tsx            root stack, fonts, theme, CrashReportGate, settings sync start
  connect.tsx            sign-in / demo mode
  (tabs)/index.tsx       Photos timeline: pinch zoom (2–6 cols), drag-to-select, fast scroller, Share/Save/Trash bar
  (tabs)/albums.tsx      Drive-folder albums; long-press → Hide / Lock; Hidden footer; Locked + Places rows
  (tabs)/search.tsx      search name/folder/camera/month/year + chips
  (tabs)/settings.tsx    "You": theme, Folders to show, Free up space, Sync settings to Google, Clear cache, Disconnect
  photo/[id].tsx         viewer: swipe, zoom, video, ⋮ menu (Save, Slideshow, Show folder, Hide folder, Open in Drive, Details)
  album/[id].tsx, folders.tsx, cleanup.tsx (duplicates/large/screenshots), locked.tsx, places.tsx (Leaflet map), slideshow.tsx
src/lib/
  auth.ts                Google sign-in, token store, ONE shared silent refresh (getValidAccessToken)
  drive.ts               Drive REST v3, appDataFolder read/write
  mediaIndex.ts          SQLite index (schema v2: md5, lat, lng, camera); all writes serialized + busy_timeout
  indexSync.ts           full scan / Changes-API delta / thumbnail repair
  folders.ts             folder tree, include/exclude scope ("nearest rule wins"), virtual "Shared & other locations"
  settingsSync.ts        hidden/locked/favorites ↔ Drive appDataFolder file drivegallery-settings.json (newer wins)
  biometrics.ts, share.ts, save.ts, memories.ts (unused since the strip was removed)
src/store/               session, folderSelection, favorites, locked, gridPrefs, selection (zustand)
src/components/          PhotoTile, ZoomableImage, DriveVideo + VideoControls, FastScroller, FloatingTabBar, GlassView, ActionMenu, CrashReportGate …
modules/crash-reporter/  local Expo module (Kotlin) — see §7
docs/                    PRD.md, privacy.md, test-checklist.md, HANDOFF.md (this file)
.github/workflows/release.yml   tag v* → EAS preview APK → GitHub Release
```

## 5. Build, run, ship

- **Dev:** `npx expo start --dev-client` on the laptop. The phone runs a *development build* APK and loads JS from the laptop (same Wi-Fi). JS-only fixes need no rebuild.
- **Builds** (EAS cloud, free plan = 15 Android builds/month, resets on the 1st):
  - `development` → dev-client APK
  - `preview` → standalone APK, arm64-v8a + armeabi-v7a only (smaller)
  - `production` → AAB (Play Store; never used yet)
- **Release:** `git tag vX.Y.Z && git push origin vX.Y.Z`. `.github/workflows/release.yml` builds the preview APK on EAS and publishes a GitHub Release with `DriveGallery-vX.Y.Z.apk`.
- **OTA updates:** expo-updates is installed, `runtimeVersion: {policy: fingerprint}`, channels development / preview / production. JS-only changes can ship with `eas update --channel preview` without a new APK. Any native change (new module, Kotlin, app.json plugins) needs a new build.
- **Pushing from this laptop:** git uses the GitHub CLI login (`gh auth setup-git`), so pushes no longer pop up an account picker. `gh` lives at `C:\Program Files\GitHub CLI\gh.exe` and isn't on git-bash's PATH.
- **Installing over an older build:** a dev build and a preview APK can't update each other. Uninstall first. Uninstalling loses on-phone settings unless "Sync settings to Google" was On.

## 6. History (2026-11-21 → 11-22)

1. Scaffold → SDK 58 upgrade → Photos timeline, viewer, video, folder selection, offline SQLite index, favorites, albums, multi-select share/trash, pinch zoom, fast scroller.
2. Release pipeline (GitHub Actions + EAS), v0.1.0.
3. Hide albums (hidden everywhere); drag-to-select; select a whole day; folders outside My Drive grouped under "Shared & other locations".
4. Batch of features: OTA updates, Free up space (duplicates by md5, large files, screenshots), Memories/On this day (later **removed** by request), Locked folder (biometric), Save to phone, better search, Places map, slideshow, custom video controls, working ⋮ menu.
5. Settings sync to the Google account (Drive appDataFolder) so hidden/locked/favorites survive sign-out and reinstall.
6. **Crash hunt.** Photos crashed on the first scroll, plus Locked and Places. No adb (new phone, no developer options), so a built-in crash reporter was added (§7). It showed a native abort in libworklets: `jsi::Value::getObject … assertion "isObject()" failed`.
   - **Root cause:** in `app/(tabs)/index.tsx` the drag-select `Gesture.Pan()` was built *before* `beginDrag/moveDrag/endDrag` were declared. Gesture worklet closures capture values when they're created, so they got `undefined`. Every touch end (every scroll) called `undefined`.
   - **Fix:** build the gestures after the handlers, and run grid/scroller/zoom/video gestures with `.runOnJS(true)`.
   - **Rule for the future:** anything a gesture/worklet callback uses must be declared above it.
7. Independent code review → fixed: shared token refresh (parallel Drive calls failed after ~1 h), serialized SQLite writes ("database is locked"), Locked re-prompting and false empty state, locked albums leaking when explicitly shown, viewer zoom not locking the pager, same-named files overwriting on Share/Save, demo mode unable to reach sign-in, session restore hanging, low-memory kills shown as crashes.
8. Launch video made with the `brag-slim` skill (github.com/latent-spaces/brag): `brag-output/brag.mp4` (gitignored; also attached to the v0.1.1 release). Its phone screens are mock-ups built from the app's code with illustrated placeholder photos. They are not real screenshots.
9. Frosted-glass tab bar redesign + "made by mikan❤️" credit (made on branch `feat/frost-glass-variant`). Tagged **v0.1.1**.

## 7. Crash reporter (keep it)

`modules/crash-reporter` (Android only) records why the app last died and shows "DriveGallery closed unexpectedly" on the next launch, with selectable text:
- Java stack trace from an uncaught-exception handler (`files/last-crash.txt`)
- the app's own logcat crash lines (readable without permissions)
- `ApplicationExitInfo` reason, and on Android 12+ the readable strings of the native tombstone

Ask the user to screenshot or copy that screen. It turned a blind native crash into the exact failing line.

## 8. Status (2026-11-22)

**Works** (tested by the owner on a Samsung, Android 17): Photos scrolling, viewer, albums, hide, Locked folder, Places, search, settings sync, everything on `docs/test-checklist.md` except Trash.

**Known issues / parked:**
- **Trash does not work.** Parked by the owner, not investigated yet. First suspect: the incremental full-`drive` scope (`ensureWriteAccess` in `auth.ts`) isn't granted, or isn't listed on the OAuth consent screen's Data access. Then check the files.update `trashed: true` PATCH in `trashItem` (`src/lib/drive.ts`).
- **"App not installed"** happened once installing the preview APK with no DriveGallery visible on the phone. It was eventually installed. If it recurs, check the Work profile and Secure Folder, re-download, then Samsung Auto Blocker.
- Offline at launch: the folder tree is fetched only from the network, so Photos/Locked can't show offline when any folder is hidden or locked.
- Places map reloads (zoom resets) while a library scan is still running.
- `album/[id]` route warning about presentation (harmless).

**Branches:** `main` = 5e3c2cc (all fixes). `feat/frost-glass-variant` = main + glass tab bar + credit + arm-only APK setting; **v0.1.1 is tagged here**. If the glass variant is accepted as production, fast-forward `main` to it (`git checkout main && git merge --ff-only feat/frost-glass-variant && git push`).

**Next:** the owner has a new feature to implement first. Then come back to Trash.
