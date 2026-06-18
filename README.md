# edite

A free, 100% in-browser video editor. Trim, split, crop, change speed and aspect ratio, mute and
export, with nothing uploaded to a server. Built to be hosted on GitHub Pages (future home:
`edite.video`).

## Features

- **Trim** clips by dragging the edges on the timeline (shrink or expand the kept range).
- **Split** at the playhead into parts and **delete** the ones you don't want.
- **Crop** with a draggable box, or start from a ratio preset.
- **Change speed** from 0.25x to 4x (video and audio stay in sync).
- **Aspect ratio** presets (16:9, 9:16, 1:1, 4:5, 4:3, 21:9) with fill (crop) or fit (bars).
- **Mute** the audio for export, with separate preview volume.
- **Live preview** that plays exactly what will be exported, skipping removed parts.
- **Export** to MP4, WebM or GIF with a quality choice and a progress bar.
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

Editing is non-destructive: every action is stored as a parameter and previewed instantly with a
native `<video>` element (playback rate, mute, aspect framing, segment boundaries). The actual
render happens only on export, where [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) runs
the equivalent FFmpeg command fully in the browser.

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
  components/   layout, upload, preview, timeline, tools, export, ui primitives
  hooks/        useVideoEngine, useFfmpeg, usePersistence
  lib/          ffmpeg (client + command builder), media (probe + thumbnails), storage, segments
  store/        Zustand editor store
  types/        shared editor types
```
