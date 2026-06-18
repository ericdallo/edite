// Copies the single-thread ffmpeg.wasm core out of node_modules into public/ffmpeg
// so it is served same-origin (no CDN, no CORS/CORP headaches on GitHub Pages).
// Runs automatically via the `predev` and `build` npm scripts.
import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// ESM build: @ffmpeg/ffmpeg runs a module worker, which can't importScripts the
// UMD core and falls back to dynamic import(), so we must ship the ESM core.
const srcDir = resolve(root, 'node_modules/@ffmpeg/core/dist/esm');
const outDir = resolve(root, 'public/ffmpeg');
const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

await mkdir(outDir, { recursive: true });

let ok = true;
for (const file of files) {
  const from = resolve(srcDir, file);
  const to = resolve(outDir, file);
  if (!(await exists(from))) {
    console.error(`[copy-ffmpeg] missing source: ${from} (did "npm install" run?)`);
    ok = false;
    continue;
  }
  await copyFile(from, to);
  console.log(`[copy-ffmpeg] ${file} -> public/ffmpeg/`);
}

if (!ok) process.exitCode = 1;
