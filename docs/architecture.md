# edite architecture

A map of how edite is built and the invariants that keep it coherent, so it
stays easy to evolve. Read this before adding a feature; the "Recipes" section
shows where new code goes.

## 1. What edite is

A 100% in-browser, privacy-first multi-track video editor. React + TypeScript +
Vite + Zustand. All decode, composite and encode happen locally via
`ffmpeg.wasm`; there is no backend, no upload and no account. It deploys as a
static site to GitHub Pages.

Two principles drive almost every design decision:

1. **Editing is non-destructive.** A project is a document that describes how to
   interpret source media. Nothing is rendered until export.
2. **Preview must match export ("what you see is what you get").** The live
   preview uses the DOM / Canvas / WebGL; the export uses `ffmpeg`. The two are
   kept in lock-step by paired helpers and shared renderers (see §3).

## 2. Module map

```
src/
  types/editor.ts      The document model + every shared type, constant and
                       pure helper that describes a project (Clip, Track,
                       ColorAdjust, ShapeStyle, TextAnim, presets, ...).
  store/editorStore.ts The single Zustand store: document state + all actions +
                       undo/redo + selection. The only place that mutates a doc.
  lib/                 Pure, framework-free logic. Co-located *.test.ts.
    timeline.ts        Time math: clip duration, source-time mapping, speed
                       curves, transitions, text-anim sampling, snapping.
    color.ts           Grade math: the CSS-filter (preview) and ffmpeg chain
                       (export) for ColorAdjust, plus shader uniforms.
    lut.ts             LUT registry, .cube parse/pack, FS filename helpers.
    chroma.ts          Chroma-key helpers (preview shader + ffmpeg filter).
    shape/render.ts    drawShape: one canvas renderer for shapes.
    text/render.ts     drawText + text measurement.
    ffmpeg/plan.ts     Document -> flat, render-ready ExportPlan.
    ffmpeg/command.ts  ExportPlan -> a single ffmpeg filter-graph + args.
    ffmpeg/operations.ts  Runs the command in ffmpeg.wasm (writes inputs,
                       rasterizes text/shape PNGs, provisions LUT cubes, execs).
    ffmpeg/client.ts   The ffmpeg.wasm singleton (load / terminate).
    media/             Decode helpers: thumbnails, waveform, poster, frame, probe.
    storage/           IndexedDB persistence + the .edite import/export bundle.
    captions/          On-device speech-to-text (WebGPU/WASM transformers).
  components/          UI, grouped by surface: preview, timeline, tools, layout,
                       export, projects, settings, media, ui (primitives).
  hooks/               Glue between the store and the browser: useHistory,
                       usePersistence, useKeyboardShortcuts, useImportMedia, ...
```

Dependency direction is one-way: `components` and `hooks` depend on `store`,
`lib` and `types`; `store` depends on `lib` and `types`; `lib` depends on
`types`; `types` depends on nothing. Keep it that way.

## 3. The central invariant: preview == export

Every visual feature is implemented twice, once for each engine, and the two are
deliberately kept adjacent so they can't drift. There are two patterns:

- **Paired helpers.** A pure function pair, one producing a preview value and one
  producing the ffmpeg fragment from the same inputs. Examples:
  `cssColorFilter` / `ffmpegColorFilter` and `gradeUniforms` in `color.ts`;
  `ffmpegChromaFilter` + the shader in `chroma.ts`; `textAnimAt` (preview) and
  the text-anim expression builder in `command.ts`. When you change one side,
  change the other in the same edit and add/extend the unit test.
- **One shared renderer.** When the same pixels can be produced by a single
  function, do that and call it from both sides. `drawText` and `drawShape` run
  in the preview canvas (`TextLayer`, `ShapeLayer`) and in the export rasterizer
  (`text/raster.ts`, `shape/raster.ts`). LUTs sample the same `.cube` in the
  WebGL shader and in `lut3d` on export.

"Match" means visually matched, not bit-exact. The legacy brightness mapping
(CSS multiply vs ffmpeg additive) has always been approximate; new work holds to
the same bar. Where exactness is cheap (per-channel gains -> `colorchannelmixer`,
text rasterization) we take it.

## 4. The document model

One `Clip` type covers every track item; its shape decides how it renders:

- **media clip** - has `mediaId`; video or image.
- **text clip** - has `text` (and optional `textAnim`); no media.
- **shape clip** - has `shape`; no media.
- **audio clip** - audio media, or a video clip with `audioOnly`.

A clip carries its placement (`rect`, fractions of the canvas), trim
(`in`/`out`), `speed`/`speedCurve`/`reversed`/`freeze`, orientation, `opacity`,
`color` (grade incl. LUT + intensity), `chromaKey`, `transition`, `keyframes`
(transform animation) and audio (`volume`, fades). Clips live on `tracks`;
compositing order is bottom track first, then start time.

`clampClip` in the store is the one chokepoint that sanitizes a clip after any
edit (ranges, fades, color). New per-clip fields should be clamped there if they
have invalid states; fields that just need to survive are preserved by the
`{ ...c }` spread automatically.

## 5. Export pipeline

```
document (tracks, clips, media)
  -> buildExportPlan()      flatten to ordered ExportClip[] + media blobs
                            (drops hidden, expands speed curves into slices)
  -> runExport()            write inputs to the wasm FS, rasterize text/shape
                            PNGs, fetch/write LUT cubes, then:
       -> buildExportCommand()  assemble ONE -filter_complex graph + codec args
       -> ffmpeg.exec()         single-thread core
  -> Blob (mp4 / webm / gif / mp3 / wav)
```

`buildExportCommand` is the heart and the riskiest file: it builds the whole
filter graph as a string (per-clip cover/crop, color grade, chroma, opacity,
transitions, keyframe and text-anim position expressions, the intensity
split/blend, then the overlay stack and the audio mix). It is covered by ~50
unit tests that assert on graph substrings; keep that ratio when extending it.

## 6. Undo and persistence

- **Undo** (`useHistory` + the store's `past`/`future`/`committed`): the store
  exposes `selectDoc`/`docsEqual`; the hook coalesces a whole gesture (pointer
  down to up) and keyboard bursts into one checkpoint, and never records during
  restores. Only the document slice is versioned, not UI/playback/customLuts.
- **Persistence** (`usePersistence` + `storage/`): the active project autosaves
  (debounced) to IndexedDB as a `ProjectSnapshot`; the last project restores on
  load. `.edite` bundles (`storage/bundle*`) export/import a project with its
  media. Playback ticks are filtered out so they don't trigger saves.

When you add a persisted field, thread it through `ProjectSnapshot`,
`snapshotFromState`, `openProject`'s hydrate, and (if it's a document edit) the
`DocSnapshot` selector so undo covers it.

## 7. Conventions

- **Tests:** Vitest, co-located next to the unit (`color.ts` ->
  `color.test.ts`). Pure logic in `lib` is the well-tested layer; components are
  thin. Test fixtures live in `src/test/factories.ts`.
- **Build gate:** `npm run build` runs `tsc --noEmit` then `vite build`. tsc is
  stricter than the editor LSP and than Vitest (which transpiles without type
  checks), so always run the build before committing.
- **Types:** prefer optional fields with a neutral default over breaking the
  model; this keeps old persisted projects loading.
- **Privacy is a feature.** No network calls for media, fonts or models beyond
  the statically-served wasm/cube/model assets. Keep it that way.

## 8. Recipes

- **A new Adjust slider / color effect:** extend `ColorAdjust` (optional,
  neutral default) in `types/editor.ts`; add the math to `color.ts`
  (`ffmpegColorFilter` + `gradeUniforms`, and the shader in `GLClipLayer.tsx`);
  clamp in `clampColor`; surface in `EffectsTool`. Add `color.test.ts` cases.
- **A new overlay type (like shapes):** add the spec to `Clip` + a default; a
  shared `drawX`/render; a preview layer; an `addXClip` store action; a branch
  in `plan.ts`; a `kind` + branch in `command.ts`; a rasterize branch in
  `operations.ts`; a tool + rail/`ToolPanel` registration; a `TimelineClip`
  label. (Grep `shape` to see the full set of touch points.)
- **A new transition:** add the id to `TransitionId` + `TRANSITIONS`; classify it
  in `transitionFamily`; render it in `command.ts` (alpha/mask/slide) and mirror
  it in the preview (`transitionRenderAt`).
- **A new export format:** extend `ExportFormat`, the codec branch in
  `command.ts`, and the dialog.

## 9. Risk register and recommended refactors

Healthy overall: clear layering, one-way deps, pure-logic core with strong
tests, no TODO/FIXME debt. Watch list, roughly by leverage:

1. **`buildExportCommand` complexity (lib/ffmpeg/command.ts).** One long
   function building a stringly-typed graph. It is the most likely place for a
   subtle regression. Recommendation: extract the per-clip "video chain" and the
   position-expression assembly into named helpers (pure, individually tested)
   without changing output. Do it behind the existing tests.
2. **`types/editor.ts` is a 700-line kitchen sink** (types + constants +
   presets + helpers). Recommendation: split into `types/` modules (clip,
   color, text, shape, export, project) re-exported from one barrel, so feature
   areas are easier to find. Low risk but wide import churn; do it in one pass.
3. **`editorStore.ts` is large (1.1k lines).** Acceptable for one cohesive store,
   but action groups (clips, tracks, captions, history, luts) could move to
   slice files combined in the store factory if it keeps growing.
4. **Single-thread ffmpeg core.** GitHub Pages can't set COOP/COEP for
   `SharedArrayBuffer`, so heavy ops are capped (reverse buffers whole clips;
   stabilization / optical-flow slow-mo are out). Documented unlock:
   `@ffmpeg/core-mt` + `coi-serviceworker`. On-device ML already ships without
   it, so multi-thread is now only an export-speed/stabilization lever.
5. **Shape orientation is intentionally absent** (flip/rotate hidden for shapes)
   to avoid the crop-on-rotate behavior of the media path; revisit with a
   center-rotation overlay expression if needed.
6. **WebGL fallbacks degrade silently:** no-WebGL draws the ungraded frame
   (preview only; export still grades), and LUT load failures skip the look.
   Fine for resilience, but means a broken GL context shows a parity gap only in
   preview.
