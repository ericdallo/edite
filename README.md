# edite

A free, multi-track video editor that runs **entirely in the browser**. Import videos and images,
stack them on layered tracks, trim/split/speed/reframe, add picture-in-picture overlays, and export
a composited MP4/WebM/GIF. No account, no upload, no server: your media never leaves the device.

Live at **[edite.video](https://edite.video)**.

## Why it exists

- **Privacy by construction.** Most "online video editors" upload your footage to a backend. edite
  does all decoding, compositing and encoding locally, so there is nothing to leak and nothing to
  trust.
- **Zero infrastructure.** The whole app is a static bundle on GitHub Pages. There is no API, no
  database, no storage bill, and no ops.
- **Multi-track, but approachable.** Inspired by tools like online-video-cutter.com / 123apps, but
  with real layers (overlays, PiP) instead of a single clip at a time.

## The core idea

Editing is **non-destructive**. The source bytes are never mutated. A project is just a small document
describing *how* to interpret the imported media: which clip to show, the trimmed range, where it sits
on the timeline, how fast it plays, and where it's drawn on the output. Nothing is rendered until you
export.

That document is the single source of truth, and what you see while editing is exactly what you get on
export. Scrubbing and playback stay instant and cheap, while export renders that same document to an
authoritative file — so "what you see" and "what you get" never drift apart.

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
