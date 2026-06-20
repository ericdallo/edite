// Generates the bundled .cube LUT looks into public/luts/, plus a small preview
// thumbnail per look into public/luts/thumbs/ (a synthetic sample image graded
// by each look, so the Filters UI can show what a look does before you pick it).
// Self-authored, deterministic color grades (CC0). Re-run with `node scripts/gen-luts.mjs`.
// Each look is a pure (r,g,b in 0..1) -> (r,g,b) function baked into a 17^3 cube.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const SIZE = 17;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'luts');
const THUMBS = join(OUT, 'thumbs');

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const mix = (a, b, t) => a + (b - a) * t;
const contrast = (x, c) => (x - 0.5) * c + 0.5;
// Lift blacks toward `amt` (a faded-film floor) and optionally pull the white point.
const lift = (x, amt) => amt + x * (1 - amt);

function saturate([r, g, b], s) {
  const l = lum(r, g, b);
  return [l + (r - l) * s, l + (g - l) * s, l + (b - l) * s];
}

// Categories are display groups for the Filters panel. Keep ids stable — they're
// referenced by saved projects and must match LUT_LOOKS in src/lib/lut.ts.
const LOOKS = [
  {
    id: 'cinematic',
    title: 'Cinematic',
    category: 'Film',
    fn: (r, g, b) => {
      // Teal shadows, warm highlights, gentle S-curve.
      const l = lum(r, g, b);
      const sh = Math.pow(1 - l, 1.5);
      const hi = Math.pow(l, 1.5);
      let rr = contrast(r, 1.12) + 0.06 * hi - 0.03 * sh;
      let gg = contrast(g, 1.12) + 0.02 * hi + 0.02 * sh;
      let bb = contrast(b, 1.12) + 0.07 * sh - 0.04 * hi;
      return saturate([rr, gg, bb], 1.05);
    },
  },
  {
    id: 'tealorange',
    title: 'Teal & Orange',
    category: 'Film',
    fn: (r, g, b) => {
      const l = lum(r, g, b);
      const sh = Math.pow(1 - l, 1.4);
      const hi = Math.pow(l, 1.4);
      const rr = contrast(r, 1.14) + 0.1 * hi - 0.05 * sh;
      const gg = contrast(g, 1.1) + 0.02 * hi - 0.01 * sh;
      const bb = contrast(b, 1.12) + 0.1 * sh - 0.06 * hi;
      return saturate([rr, gg, bb], 1.08);
    },
  },
  {
    id: 'bleach',
    title: 'Bleach',
    category: 'Film',
    fn: (r, g, b) => {
      // Bleach bypass: high contrast, drained color blended toward luma.
      const l = lum(r, g, b);
      const [sr, sg, sb] = saturate([r, g, b], 0.5);
      return [
        mix(contrast(sr, 1.25), l, 0.22),
        mix(contrast(sg, 1.25), l, 0.22),
        mix(contrast(sb, 1.25), l, 0.22),
      ];
    },
  },
  {
    id: 'noir',
    title: 'Noir',
    category: 'Mono',
    fn: (r, g, b) => {
      const l = contrast(lum(r, g, b), 1.28);
      const sh = Math.pow(1 - l, 2);
      // Mono with a cool toe.
      return [l - 0.01 * sh, l, l + 0.04 * sh];
    },
  },
  {
    id: 'mono',
    title: 'Mono',
    category: 'Mono',
    fn: (r, g, b) => {
      const l = contrast(lum(r, g, b), 1.12);
      return [l, l, l];
    },
  },
  {
    id: 'ink',
    title: 'Ink',
    category: 'Mono',
    fn: (r, g, b) => {
      const l = Math.pow(clamp01(contrast(lum(r, g, b), 1.42)), 0.92);
      return [l, l, l];
    },
  },
  {
    id: 'portrait',
    title: 'Portrait',
    category: 'Portrait',
    fn: (r, g, b) => {
      let rr = r * 1.05;
      let gg = g * 1.0;
      let bb = b * 0.97;
      // Soften: lift shadows a touch, ease contrast, calm saturation.
      rr = lift(contrast(rr, 1.03), 0.03);
      gg = lift(contrast(gg, 1.03), 0.03);
      bb = lift(contrast(bb, 1.03), 0.03);
      return saturate([rr, gg, bb], 0.97);
    },
  },
  {
    id: 'glow',
    title: 'Glow',
    category: 'Portrait',
    fn: (r, g, b) => {
      // Bright, warm, soft — flattering high-key skin.
      const rr = lift(contrast(r * 1.05, 0.96), 0.05) + 0.015;
      const gg = lift(contrast(g * 1.01, 0.96), 0.04);
      const bb = lift(contrast(b * 0.97, 0.96), 0.03);
      return saturate([rr, gg, bb], 0.98);
    },
  },
  {
    id: 'rosy',
    title: 'Rosy',
    category: 'Portrait',
    fn: (r, g, b) => {
      const rr = r * 1.06 + 0.02;
      const gg = g * 0.99;
      const bb = b * 0.99;
      return saturate([rr, gg, bb], 1.06);
    },
  },
  {
    id: 'faded',
    title: 'Faded',
    category: 'Vintage',
    fn: (r, g, b) => {
      // Lifted matte blacks, low contrast, warm-yellow cast, washed colour.
      let rr = lift(contrast(r * 1.03, 0.88), 0.08);
      let gg = lift(contrast(g * 1.01, 0.88), 0.07);
      let bb = lift(contrast(b * 0.95, 0.88), 0.05);
      return saturate([rr, gg, bb], 0.82);
    },
  },
  {
    id: 'vintage',
    title: 'Vintage',
    category: 'Vintage',
    fn: (r, g, b) => {
      const rr = lift(contrast(r * 1.05, 0.9), 0.06);
      const gg = lift(contrast(g * 1.0, 0.9), 0.05);
      const bb = lift(contrast(b * 0.92, 0.9), 0.04);
      return saturate([rr, gg, bb], 0.78);
    },
  },
  {
    id: 'sepia',
    title: 'Sepia',
    category: 'Vintage',
    fn: (r, g, b) => {
      const l = contrast(lum(r, g, b), 1.05);
      return [l * 1.07 + 0.04, l * 0.95 + 0.02, l * 0.74];
    },
  },
  {
    id: 'vivid',
    title: 'Vivid',
    category: 'Vibrant',
    fn: (r, g, b) => {
      let [rr, gg, bb] = saturate([r, g, b], 1.32);
      rr = contrast(rr, 1.08);
      gg = contrast(gg, 1.08);
      bb = contrast(bb * 1.03, 1.08); // cooler sky
      return [rr, gg, bb];
    },
  },
  {
    id: 'punch',
    title: 'Punch',
    category: 'Vibrant',
    fn: (r, g, b) => {
      const [rr, gg, bb] = saturate([r, g, b], 1.45);
      return [contrast(rr, 1.14), contrast(gg, 1.14), contrast(bb, 1.14)];
    },
  },
  {
    id: 'y2k',
    title: 'Y2K',
    category: 'Vibrant',
    fn: (r, g, b) => {
      const rr = contrast(r * 1.05, 1.1);
      const gg = contrast(g * 0.98, 1.1);
      const bb = contrast(b * 1.06, 1.1);
      return saturate([rr, gg, bb], 1.3);
    },
  },
  {
    id: 'cool',
    title: 'Cool',
    category: 'Cool',
    fn: (r, g, b) => {
      const rr = contrast(r * 0.98, 1.05);
      const gg = contrast(g, 1.05);
      const bb = contrast(b * 1.05, 1.05);
      return saturate([rr, gg, bb], 1.08);
    },
  },
  {
    id: 'arctic',
    title: 'Arctic',
    category: 'Cool',
    fn: (r, g, b) => {
      const rr = lift(r * 0.96, 0.04);
      const gg = lift(g, 0.04);
      const bb = lift(b * 1.08, 0.05);
      return saturate([contrast(rr, 1.06), contrast(gg, 1.06), contrast(bb, 1.06)], 0.96);
    },
  },
  {
    id: 'warm',
    title: 'Warm',
    category: 'Warm',
    fn: (r, g, b) => {
      const rr = contrast(r * 1.05, 1.05) + 0.02;
      const gg = contrast(g * 1.01, 1.05);
      const bb = contrast(b * 0.95, 1.05);
      return saturate([rr, gg, bb], 1.12);
    },
  },
  {
    id: 'golden',
    title: 'Golden',
    category: 'Warm',
    fn: (r, g, b) => {
      const hi = Math.pow(lum(r, g, b), 1.3);
      const rr = contrast(r * 1.06, 1.06) + 0.04 * hi;
      const gg = contrast(g, 1.06) + 0.01 * hi;
      const bb = contrast(b * 0.9, 1.06) - 0.02 * hi;
      return saturate([rr, gg, bb], 1.1);
    },
  },
  {
    id: 'sunset',
    title: 'Sunset',
    category: 'Warm',
    fn: (r, g, b) => {
      const rr = r * 1.08 + 0.04;
      const gg = g * 0.98 + 0.01;
      const bb = b * 0.96;
      return saturate([contrast(rr, 1.04), contrast(gg, 1.04), contrast(bb, 1.04)], 1.15);
    },
  },
  {
    id: 'appetite',
    title: 'Appetite',
    category: 'Food',
    fn: (r, g, b) => {
      let rr = r * 1.05 + 0.02;
      let gg = g * 1.01 + 0.01;
      let bb = b * 0.97;
      return saturate([rr, gg, bb], 1.18);
    },
  },
  {
    id: 'fresh',
    title: 'Fresh',
    category: 'Food',
    fn: (r, g, b) => {
      const rr = contrast(r * 1.01, 1.08);
      const gg = contrast(g * 1.03, 1.08);
      const bb = contrast(b, 1.08);
      return saturate([rr, gg, bb], 1.12);
    },
  },
  {
    id: 'moody',
    title: 'Moody',
    category: 'Scenery',
    fn: (r, g, b) => {
      // Cool, crushed, desaturated.
      let rr = Math.pow(clamp01(r * 0.97), 1.08);
      let gg = Math.pow(clamp01(g), 1.06);
      let bb = Math.pow(clamp01(b * 1.06), 1.04);
      return saturate([contrast(rr, 1.1), contrast(gg, 1.1), contrast(bb, 1.1)], 0.9);
    },
  },
  {
    id: 'azure',
    title: 'Azure',
    category: 'Scenery',
    fn: (r, g, b) => {
      const rr = r * 0.97;
      const gg = g * 1.0;
      const bb = b * 1.06;
      return saturate([contrast(rr, 1.06), contrast(gg, 1.06), contrast(bb, 1.06)], 1.16);
    },
  },
];

function buildCube({ id, title, fn }) {
  const lines = [`# edite look: ${title} (CC0)`, `TITLE "${title}"`, `LUT_3D_SIZE ${SIZE}`, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0'];
  const d = SIZE - 1;
  for (let bi = 0; bi < SIZE; bi++) {
    for (let gi = 0; gi < SIZE; gi++) {
      for (let ri = 0; ri < SIZE; ri++) {
        const [r, g, b] = fn(ri / d, gi / d, bi / d);
        lines.push(`${clamp01(r).toFixed(4)} ${clamp01(g).toFixed(4)} ${clamp01(b).toFixed(4)}`);
      }
    }
  }
  return lines.join('\n') + '\n';
}

// --- Thumbnails ------------------------------------------------------------
// A synthetic sample image (no external asset, CC0): a hue/luma gradient over a
// strip of memory-colour chips (skin, sky, foliage, red, neutral, gold), so each
// look's warmth, contrast, saturation and mono behaviour reads at a glance.
const TW = 96;
const TH = 64;
const CHIP_H = 16;
const GRAD_H = TH - CHIP_H;
const CHIPS = [
  [0.91, 0.71, 0.56], // skin
  [0.47, 0.72, 0.93], // sky
  [0.36, 0.6, 0.27], // foliage
  [0.84, 0.28, 0.25], // red
  [0.61, 0.61, 0.61], // neutral
  [0.93, 0.76, 0.31], // gold
];

function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (t) => {
    let tc = t;
    if (tc < 0) tc += 1;
    if (tc > 1) tc -= 1;
    if (tc < 1 / 6) return p + (q - p) * 6 * tc;
    if (tc < 1 / 2) return q;
    if (tc < 2 / 3) return p + (q - p) * (2 / 3 - tc) * 6;
    return p;
  };
  return [hk(h + 1 / 3), hk(h), hk(h - 1 / 3)];
}

function buildSample() {
  const buf = Buffer.alloc(TW * TH * 3);
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      let rgb;
      if (y >= GRAD_H) {
        rgb = CHIPS[Math.min(CHIPS.length - 1, Math.floor((x / TW) * CHIPS.length))];
      } else {
        const hue = (x / (TW - 1)) * 0.78; // red -> blue/violet
        const light = mix(0.86, 0.2, y / (GRAD_H - 1));
        rgb = hslToRgb(hue, 0.55, light);
      }
      const o = (y * TW + x) * 3;
      buf[o] = Math.round(clamp01(rgb[0]) * 255);
      buf[o + 1] = Math.round(clamp01(rgb[1]) * 255);
      buf[o + 2] = Math.round(clamp01(rgb[2]) * 255);
    }
  }
  return buf;
}

function gradeSample(sample, fn) {
  const out = Buffer.alloc(sample.length);
  for (let i = 0; i < sample.length; i += 3) {
    const [rr, gg, bb] = fn(sample[i] / 255, sample[i + 1] / 255, sample[i + 2] / 255);
    out[i] = Math.round(clamp01(rr) * 255);
    out[i + 1] = Math.round(clamp01(gg) * 255);
    out[i + 2] = Math.round(clamp01(bb) * 255);
  }
  return out;
}

// Minimal truecolor (8-bit RGB) PNG encoder using node:zlib — no dependencies.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolor RGB
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

// --- Write -----------------------------------------------------------------
mkdirSync(OUT, { recursive: true });
mkdirSync(THUMBS, { recursive: true });

const sample = buildSample();
writeFileSync(join(THUMBS, '_original.png'), encodePng(TW, TH, sample));

for (const look of LOOKS) {
  writeFileSync(join(OUT, `${look.id}.cube`), buildCube(look));
  writeFileSync(join(THUMBS, `${look.id}.png`), encodePng(TW, TH, gradeSample(sample, look.fn)));
  console.log(`[gen-luts] ${look.id}.cube + thumb (${look.category})`);
}
console.log(`[gen-luts] wrote ${LOOKS.length} looks (+ _original thumb) to public/luts/`);
