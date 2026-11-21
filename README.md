# DriveGallery

A Google Photos–style gallery for the images and videos already in your Google Drive. Built with **Expo (React Native)** for Android and iOS. Your files stay in Drive — the app is a viewer, with an on-device index so it opens instantly.

Design: **Twilight Stillness** — Lora + Outfit type, liquid-glass tab bar, two themes: **Paper** (light) and **Twilight** (dark).

Specs: [`docs/PRD.md`](docs/PRD.md) · Privacy: [`docs/privacy.md`](docs/privacy.md)

## Features

- Timeline grouped by day, **pinch to zoom** (2–6 per row), Samsung-style **fast scroller** with a date bubble
- **Offline index** (SQLite + Drive Changes API): instant launch, whole-library scrolling, delta sync
- **Folder selection**: show/hide Drive folders (subfolders included, exclusions supported)
- Full-screen viewer: swipe, pinch/double-tap zoom, **video playback** (streams from Drive), info with folder path
- **Multi-select** (long-press): share or move to Trash in bulk
- **Favorites**, Drive-folder **Albums**, search by filename
- Sign in with Google (read-only); edit access is requested only the first time you delete

## Quick start (UI only, demo photos)

```bash
npm install
npm start
```

Open in Expo Go and tap **Explore with demo photos**. Real Google sign-in needs a development build (below).

## Development build

Native modules (Google Sign-In, sharing, SQLite) need your own build of the app instead of Expo Go. EAS builds it in the cloud — no Android Studio needed:

```bash
npx eas-cli login
npx eas-cli build --profile development --platform android
```

Install the APK from the link EAS prints, then:

```bash
npx expo start --dev-client
```

…and open the project from the installed **DriveGallery** app. Rebuild whenever a native module is added (JS changes hot-reload).

## Google sign-in setup

In [Google Cloud Console](https://console.cloud.google.com) (Google Auth Platform):

1. Enable the **Google Drive API**.
2. **Data Access** → add scopes `.../auth/drive.readonly` and `.../auth/drive`.
3. **Audience** → while in *Testing*, add every user's Gmail as a **test user** (max 100).
4. **Clients** → create a **Web application** client (put its ID in `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, and as an EAS env var for cloud builds) and an **Android** client with package `com.mikansenpai.drivegallery` and the SHA-1 from *expo.dev → project → Credentials → Android*.

## Releasing

**Friends release (≤100 test users)** — an installable APK, no Play Store:

```bash
npx eas-cli build --profile preview --platform android
```

Share the APK link; each friend's Gmail must be on the test-user list. Preview builds use the same signing key as development builds, so the existing Android OAuth client works.

**Play Store** (`production` profile, AAB):

```bash
npx eas-cli build --profile production --platform android
npx eas-cli submit --platform android
```

- Play **App Signing** re-signs the app with Google's key, which has a **different SHA-1**. Copy it from *Play Console → Setup → App signing* and create a **second Android OAuth client** with it, or sign-in fails in Play installs.
- Above 100 users, Google requires **OAuth verification** for the restricted Drive scopes, including a third-party security assessment (CASA). Plan weeks of lead time.
- The Play listing needs the privacy policy URL ([`docs/privacy.md`](docs/privacy.md), host it publicly) and the Data safety form (no data collected or shared off-device).

Regenerate icons after editing the artwork: `node scripts/render-icons.mjs`.

## Project structure

```
app/
  _layout.tsx           Providers, fonts, theme, routes
  connect.tsx           Sign in with Google / demo
  (tabs)/               Photos (timeline) · Albums · Search · You
  photo/[id].tsx        Viewer (swipe, zoom, video, share, trash, info)
  album/[id].tsx        Album grid
  folders.tsx           Folder show/hide picker
src/
  lib/                  auth, drive (REST v3), mediaIndex (SQLite), indexSync, folders, share, cache
  hooks/useMedia.ts     Media/folder data for screens
  store/                session, folder selection, favorites, grid prefs, selection
  components/           GlassView, FloatingTabBar, FastScroller, PhotoTile, ZoomableImage, DriveVideo, …
  theme/                Tokens (Paper/Twilight), ThemeProvider, blur target
scripts/render-icons.mjs  Icon + splash artwork
```

## Checks

```bash
npx tsc --noEmit
npx eslint app src
npx -y expo-doctor
```

## License

MIT — see [LICENSE](LICENSE).
