// Copies the ffmpeg.wasm cores out of node_modules into public/ so they are
// served same-origin (no CDN, no CORS/CORP headaches on GitHub Pages). Ships
// both the single-thread core (public/ffmpeg, always usable) and the
// multi-thread core (public/ffmpeg-mt, used only when the page is cross-origin
// isolated). Runs automatically via the `predev` and `build` npm scripts.
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ESM build: @ffmpeg/ffmpeg runs a module worker, which can't importScripts the
// UMD core and falls back to dynamic import(), so we must ship the ESM cores.
const jobs = [
  {
    srcDir: resolve(root, 'node_modules/@ffmpeg/core/dist/esm'),
    outDir: resolve(root, 'public/ffmpeg'),
    files: ['ffmpeg-core.js', 'ffmpeg-core.wasm'],
  },
  {
    // The multi-thread core also ships a worker and only runs under
    // SharedArrayBuffer (cross-origin isolated). The client falls back to the
    // single-thread core when isolation isn't available.
    srcDir: resolve(root, 'node_modules/@ffmpeg/core-mt/dist/esm'),
    outDir: resolve(root, 'public/ffmpeg-mt'),
    files: ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js'],
  },
];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

let ok = true;
for (const { srcDir, outDir, files } of jobs) {
  await mkdir(outDir, { recursive: true });
  for (const file of files) {
    const from = resolve(srcDir, file);
    const to = resolve(outDir, file);
    if (!(await exists(from))) {
      console.error(`[copy-ffmpeg] missing source: ${from} (did "npm install" run?)`);
      ok = false;
      continue;
    }
    await copyFile(from, to);
    console.log(`[copy-ffmpeg] ${file} -> ${relative(root, outDir)}/`);
  }
}

if (!ok) process.exitCode = 1;
