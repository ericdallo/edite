# edite

A free, 100% in-browser multi-track video editor. Stack videos and images on layered tracks, trim,
split, change speed, reframe, add overlays (picture-in-picture) and export — with nothing uploaded
to a server. Built to be hosted on GitHub Pages (future home: `edite.video`).

## Features

- **Multiple tracks** — stack videos and images on layered tracks; higher tracks render on top, so you get overlays and picture-in-picture.
- **Media library** — upload several videos/images; each lands on its own track and can be re-added.
- **Trim, split, duplicate, copy/paste, mute, hide, delete** clips (toolbar, right-click menu or keyboard).
- **Drag clips** anywhere along the timeline and across tracks.
- **Transform** — move, resize and set the opacity of any clip on the canvas by dragging the box on the preview.
- **Speed** per clip from 0.25x to 4x (audio stays in sync).
- **Aspect ratio** canvas presets (16:9, 9:16, 1:1, 4:5, 4:3, 21:9).
- **Audio** — global mute plus per-clip and per-track mute, with a separate preview volume.
- **Keyboard shortcuts** — S split, Space/K play, Del delete, arrows to nudge, ⌘/Ctrl+C/V/D, ⌘/Ctrl +/− to zoom (keyboard button in the top bar).
- **Fast timeline** — click to seek, drag to pan, Ctrl/⌘+scroll to zoom to the cursor, wheel to scroll.
- **Live layered preview** that plays what will be exported.
- **Export** to MP4, WebM or GIF — composited with overlays + audio mixing — with quality and progress.
- Projects are saved locally (IndexedDB) and restored on reload. No accounts, no tracking.

## Quick start

```bash
npm install
npm run dev
```

Then open the printed URL (the dev server uses the `/edite/` base path).

## Build

```bash
npm run build      # typecheck + production build into dist/
npm run preview    # serve the built app locally
```

The `predev`/`build` steps copy the ffmpeg.wasm core out of `node_modules` into `public/ffmpeg/`
(gitignored) so it is served same-origin.

## Deploy (GitHub Pages)

Pushing to `master` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to Pages.
Enable Pages once in the repo settings (Source: GitHub Actions).

- The Vite `base` is `/edite/`, which matches a project site at `https://<user>.github.io/edite/`.
  If your repo has a different name, update `base` in `vite.config.ts`.
- For the custom domain `edite.video`, set `base: '/'` in `vite.config.ts` and add a `public/CNAME`
  file containing `edite.video`.

## How it works

Editing is non-destructive: clips are placed on tracks and previewed live by layering native
`<video>`/`<img>` elements, synced to one timeline clock. The actual render happens only on export,
where [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) composites every clip (scale, place,
opacity, overlay, audio mix) onto the chosen canvas fully in the browser.

This uses the single-thread ffmpeg core, so it needs no special headers and works on GitHub Pages
as-is. To enable the faster multi-thread core later, switch to `@ffmpeg/core-mt` and add
cross-origin isolation (COOP/COEP). Pages can't set headers directly, so use a service worker such
as [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker).

## Tech stack

React + TypeScript + Vite, Tailwind CSS v4, Zustand for state, ffmpeg.wasm for processing, IndexedDB
(`idb`) for storage, lucide-react for icons.

## Project structure

```
src/
  components/   layout, upload, media, preview, timeline, tools, export, ui primitives
  hooks/        useImportMedia, useFfmpeg, usePersistence, useKeyboardShortcuts
  lib/          ffmpeg (client + compositing command builder), media (probe + thumbnails), storage, timeline math
  store/        Zustand editor store (media, tracks, clips)
  types/        shared editor types
```
