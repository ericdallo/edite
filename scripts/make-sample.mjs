// Produces scripts/sample.png — the base portrait the filter thumbnails are
// graded on (see scripts/gen-luts.mjs). One-time ingest of a source photo: a
// square crop on the subject, downscaled, re-encoded as a simple RGB PNG that
// the generator can read with Node alone.
//
//   node scripts/make-sample.mjs <source-image> [size]
//
// Requires ImageMagick (`magick`) on PATH. Only scripts/sample.png is committed;
// the source photo is not kept in the repo.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png.mjs';

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/make-sample.mjs <source-image> [size]');
  process.exit(1);
}
const size = Number(process.argv[3]) || 128;
const out = join(dirname(fileURLToPath(import.meta.url)), 'sample.png');

// Fill to a square (smaller side = size) then centre-crop, so a portrait keeps
// the face. Emit raw 8-bit RGB to stdout and wrap it as a simple PNG.
const raw = execFileSync(
  'magick',
  [
    src,
    '-auto-orient',
    '-resize',
    `${size}x${size}^`,
    '-gravity',
    'Center',
    '-extent',
    `${size}x${size}`,
    '-depth',
    '8',
    'RGB:-',
  ],
  { maxBuffer: 1 << 28 },
);

if (raw.length !== size * size * 3) {
  throw new Error(`expected ${size * size * 3} bytes from magick, got ${raw.length}`);
}
writeFileSync(out, encodePng(size, size, raw));
console.log(`[make-sample] wrote ${out} (${size}x${size}) from ${src}`);
