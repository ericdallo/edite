# edite

A free, multi-track video editor that runs **entirely in the browser**. Import videos and images,
stack them on layered tracks, trim/split/speed/reframe, add picture-in-picture overlays, and export
a composited MP4/WebM/GIF. No account, no upload, no server: your media never leaves the device.

Live at **[edite.video](https://edite.video)**.

This document is for people who want to understand *what edite is and why it's built the way it is*,
more than how to run it. Setup lives at the bottom.

## Why it exists

- **Privacy by construction.** Most "online video editors" upload your footage to a backend. edite
  does all decoding, compositing and encoding locally, so there is nothing to leak and nothing to
  trust.
- **Zero infrastructure.** The whole app is a static bundle on GitHub Pages. There is no API, no
  database, no storage bill, and no ops. That constraint shapes most of the technical decisions
  below.
- **Multi-track, but approachable.** Inspired by tools like online-video-cutter.com / 123apps, but
  with real layers (overlays, PiP) instead of a single clip at a time.

## The core idea

Editing is **non-destructive**. The source bytes are never mutated. A project is just a small,
serializable document describing *how* to interpret the imported media:

- A **Clip** points at a `MediaItem`, a trimmed source range (`in`/`out`), a timeline position
  (`start`), a `speed`, and where to draw it on the output canvas (`rect`, `opacity`).
- Nothing is rendered until you export.

That document is the single source of truth, and it is interpreted by **two independent render
paths**:

1. **Live preview** (`components/preview/VideoPreview.tsx`). Native `<video>`/`<img>` elements are
   layered in the DOM and driven by one master clock (a `requestAnimationFrame` loop). This makes
   scrubbing and playback instant and cheap, with no encoding involved. Inactive clips are parked on
   their nearest frame and hidden with `opacity: 0` (not `display: none`) so a cut never flashes a
   black/first frame while the browser seeks.
2. **Export** (`lib/ffmpeg/*`). The exact same document is compiled into a single
   [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) `filter_complex` graph and rendered to a
   file. This is the authoritative output.

Keeping these two paths fed by one document is what keeps "what you see" and "what you get" in sync.

## Data model

Defined in `src/types/editor.ts`:

| Type | Meaning |
| --- | --- |
| `MediaItem` | An imported source (video or image) plus probed metadata, its `blob`, and a runtime object `url`. |
| `Track` | A layer. **`tracks[0]` is the bottom layer; the last track is the top.** Tracks can be hidden/muted. |
| `Clip` | A placement of a media item on a track: `start`, `in`/`out`, `speed`, `rect` (0..1 fractions of the canvas), `opacity`, `muted`, `hidden`. |

Timeline math is centralized and pure in `src/lib/timeline.ts`:

- `clipTimelineDuration = (out - in) / speed`
- `clipEnd = start + clipTimelineDuration`
- `projectDuration` = the latest clip end
- `clipSourceAt(clip, t)` maps a timeline time to a source time (clamped to the trim)
- `isClipActiveAt(clip, t)` gates a clip to its visible window

**Compositing order** is always bottom track to top track, and within a track by `start`. Both the
preview and the exporter derive ordering this way, so overlays/PiP behave identically in each.

## Architecture

```
src/
  types/editor.ts        data model, aspect & export presets, canvasSize()
  store/editorStore.ts   single Zustand store: document, selection, playback, undo/redo
  lib/
    timeline.ts          clip/timeline math + snapping (pure)
    constants.ts         shared domain constants (MIN_CLIP, history limit, speed/zoom bounds)
    ids.ts / utils.ts    uid, clamp, formatters, cn()
    media/               probe (metadata via <video>/<img>) + thumbnail sampling
    storage/projects.ts  IndexedDB persistence (snapshots + media blobs)
    ffmpeg/
      client.ts          lazy singleton loader for the wasm core + terminate()
      plan.ts            document -> flat, ordered, render-ready clip list (pure)
      command.ts         plan + canvas/fps/format -> ffmpeg args (pure)
      operations.ts      runs ffmpeg in the wasm FS; cancelable via AbortSignal
  hooks/                 useImportMedia, useFfmpeg, usePersistence, useHistory, useKeyboardShortcuts
  components/            layout, upload, media, preview, timeline, tools, export, ui primitives
```

A few decisions worth calling out:

- **State is one immutable Zustand store.** Every update returns new references, so reference
  equality doubles as a change test. This is what makes undo/redo and autosave cheap.
- **Undo/redo is snapshot based.** The store tracks a `DocSnapshot` (media/tracks/clips/aspect/
  muted/projectName). `commitHistory()` pushes the previous committed snapshot onto `past[]` and is a
  no-op when nothing changed (so restores never create spurious entries). `useHistory` *coalesces* a
  whole interaction into one entry: nothing commits while a pointer is down, and keyboard bursts are
  debounced, so one drag/trim/slider gesture is one undo step.
- **Persistence is automatic and local.** `usePersistence` debounces writes of the snapshot + media
  blobs to IndexedDB and restores the last project on load. It ignores playback-only changes so the
  ~60fps clock doesn't thrash the save timer.
- **The hot, risky logic is pure and isolated.** Timeline math, snapping, the export *plan*, and the
  ffmpeg *command* are plain functions with no React/DOM, which is why they can be unit tested
  directly. Components stay declarative and thin.

## Notable constraints & trade-offs

- **Single-thread ffmpeg core.** The multi-thread core needs `SharedArrayBuffer`, which needs
  cross-origin isolation (COOP/COEP headers). GitHub Pages can't set headers, so edite ships the
  single-thread core and needs zero header config. The core is copied out of `node_modules` into
  `public/ffmpeg/` (same-origin, gitignored) by `scripts/copy-ffmpeg.mjs` on `predev`/`build`. To go
  multi-thread later, switch to `@ffmpeg/core-mt` and add isolation via something like
  [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker).
- **Export is cancelable** only by terminating the worker (`terminateFFmpeg()`), because a running
  `exec` can't otherwise be interrupted. The next export loads a fresh instance.
- **ffmpeg PTS handling.** Each clip's PTS is shifted to its timeline `start` and `eof_action=repeat`
  holds the last frame at clip boundaries; without this, things like the tail of a split render a
  frame of black at the junction. See the comments in `lib/ffmpeg/command.ts`.

## Tech stack

React 18 + TypeScript + Vite 6, Tailwind CSS v4 (CSS-first `@theme`), Zustand, ffmpeg.wasm, `idb`
for IndexedDB, lucide-react for icons, Vitest for tests.

## Testing

Pure logic is covered by Vitest (node environment, no DOM): timeline math + snapping, the export
plan, the ffmpeg command builder, and the store reducers including undo/redo coalescing.

```bash
npm run test       # watch mode
npm run test:run   # one-shot (also runs in CI before every deploy)
```

## Develop, build, deploy

```bash
npm install
npm run dev        # predev copies the ffmpeg core into public/ffmpeg
npm run build      # typecheck + production build into dist/
npm run preview    # serve the build locally
```

Pushing to `master` triggers `.github/workflows/deploy.yml`, which installs, runs the tests, builds,
and publishes `dist/` to the `gh-pages` branch. The custom domain is configured via `public/CNAME`
(`edite.video`) with Vite `base: '/'`.
