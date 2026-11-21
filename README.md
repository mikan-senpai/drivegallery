# DriveGallery

A read-only, Google Photos–style gallery for the images and videos in your Google Drive. Built with **Expo (React Native)** for iOS and Android. Files stay in Drive — this is a viewer, not a backup tool.

Design: **Twilight Stillness**, minimal — Lora + Outfit type, squircle tiles, hairline cards, floating blur tab bar. Two themes: **Paper** (light, default) and **Twilight** (dark).

See [`docs/PRD.md`](docs/PRD.md) for the full product spec.

## Quick start

```bash
npm install
npx expo install --fix   # align native deps to this SDK
npm start                # open in demo mode (mock photos, no sign-in)
```

Tap **"Explore with demo photos"** on the connect screen to browse the UI immediately in Expo Go. Real Google sign-in needs a native build (below).

## Project structure

```
app/                     Expo Router routes
  _layout.tsx            Providers, fonts, query client, error boundary
  index.tsx              Connect / OAuth screen
  (tabs)/                Photos · Albums · Search · You
  photo/[id].tsx         Full-screen viewer (pinch-zoom)
src/
  theme/                 Tokens (Paper/Twilight) + ThemeProvider
  lib/                   auth, drive (REST v3), grouping, format, types, mock
  hooks/useMedia.ts      TanStack Query data access
  store/session.ts       Session state (Zustand)
  components/            FloatingTabBar, PhotoTile, ScreenHeader, …
```

## Auth setup (real Drive)

Google Sign-In does not run in Expo Go — use a development build.

1. **Google Cloud Console** → create OAuth client IDs (Web, iOS, Android). Enable the **Google Drive API**. Add scope `.../auth/drive.readonly`.
2. Copy `.env.example` → `.env` and fill the client IDs.
3. Set the iOS URL scheme in `app.json` (`iosUrlScheme`) to your reversed iOS client ID.
4. Build and run a dev client:
   ```bash
   npx expo prebuild
   npx expo run:ios      # or run:android
   ```

The app requests **`drive.readonly`** only. Removing an item ("Move to Trash") needs the `drive.file` write scope, requested separately and on demand.

## Tech

Expo Router · TypeScript (strict) · expo-image · FlashList · Reanimated + Gesture Handler · expo-secure-store (tokens) · TanStack Query · Zustand · @react-native-google-signin.

## Production checklist

- [ ] Google OAuth **verification** for restricted scopes (required before public release — allow lead time).
- [ ] Swap demo data for live indexing: SQLite index + Drive **Changes API** delta sync (see PRD §Drive integration).
- [ ] Thumbnail cache: FileSystem LRU keyed by `fileId+modifiedTime`; re-fetch expiring `thumbnailLink`s.
- [ ] EAS Build + Submit config; app icons & splash.
- [ ] Error monitoring (e.g. Sentry) and analytics for the PRD success metrics.
- [ ] Unit tests for `grouping`, `format`, `drive` parsing; E2E smoke on connect → timeline → viewer.

## License

MIT — see [LICENSE](LICENSE).
