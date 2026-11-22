# DriveGallery phone test checklist

Run on the dev build connected to the laptop's dev server. If the app closes,
reopen it and paste the "closed unexpectedly" report.

## Photos
- [ ] Scroll fast up and down for 20 s
- [ ] Fling to the bottom, then back to top
- [ ] Drag the fast-scroller handle on the right edge
- [ ] Pinch in and out (columns change)
- [ ] Long-press a photo, then drag across rows to select (list auto-scrolls at edges)
- [ ] Tap a date header while selecting (whole day toggles)
- [ ] Selection bar: Share, Save, Trash (trash 1 test photo)
- [ ] Header hides on scroll down, returns on scroll up

## Viewer
- [ ] Open a photo, swipe left/right through 10+
- [ ] Pinch zoom, pan while zoomed, double-tap zoom in/out
- [ ] Open a video: play/pause, drag seek bar, mute
- [ ] ⋮ menu: Save to phone, Slideshow, Show folder, Hide this folder, Open in Google Drive, Details
- [ ] Favourite on/off

## Albums
- [ ] Open 3 albums and scroll each
- [ ] Long-press an album → Hide → it disappears from Albums, Photos and Search
- [ ] Hidden albums footer → Unhide
- [ ] Long-press an album → Lock
- [ ] Album ▶ slideshow

## Locked folder
- [ ] Open → fingerprint prompt → unlock → photos show
- [ ] Cancel the prompt → Unlock button works
- [ ] Open a locked photo, swipe
- [ ] Switch to another app and back → it's locked again
- [ ] Tap an album chip → Move out

## Places
- [ ] Map loads, pins cluster
- [ ] Tap a pin/cluster → strip of photos → open one
- [ ] Pan/zoom the map for 20 s

## Search
- [ ] Type a folder name, a month, a year, a camera
- [ ] Filter chips (type/year/camera)

## Free up space
- [ ] Duplicates, Large files, Screenshots tabs load
- [ ] Trash 1 duplicate

## You (settings)
- [ ] Theme: Paper / Twilight / System
- [ ] Sync settings to Google: turn on → shows "On · synced"
- [ ] Clear cache → thumbnails reload
- [ ] Disconnect → sign in again → hidden/locked/favourites come back

## App lifecycle
- [ ] Background the app for 1 min, return
- [ ] Rotate the phone on Photos and in the viewer
- [ ] Airplane mode: scroll Photos (cached), open a photo
