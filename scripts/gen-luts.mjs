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
// A self-authored landscape scene (no external asset, CC0): a golden-hour sky
// with a low sun over layered green hills, plus a little grain. It's real-scene
// content — sky blue, warm sunlight, greens, shadows and highlights — so a
// look's warmth, contrast and saturation read at a glance, like the sample photo
// CapCut previews filters on.
const TW = 120;
const TH = 80;

const smooth = (t) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};
// Deterministic per-pixel pseudo-random in 0..1, for a touch of film grain.
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

const HORIZON = 0.6;
const SUN_X = 0.7;
const SUN_Y = HORIZON - 0.04;
const SKY_TOP = [0.17, 0.35, 0.62];
const SKY_HORIZON = [1.0, 0.76, 0.5];

// Sky colour + sun glow at a point (also reused for the horizon haze).
function skyAt(fx, fy) {
  const base = mix3(SKY_TOP, SKY_HORIZON, smooth(Math.max(0, fy) / HORIZON));
  const d = Math.hypot(fx - SUN_X, (fy - SUN_Y) * 1.35);
  const glow = Math.exp(-(d * d) / (2 * 0.11 * 0.11));
  const core = Math.exp(-(d * d) / (2 * 0.025 * 0.025));
  return [
    base[0] + 1.0 * glow * 0.7 + core * 0.5,
    base[1] + 0.86 * glow * 0.7 + core * 0.5,
    base[2] + 0.62 * glow * 0.7 + core * 0.45,
  ];
}

// Three green hill layers, back (sunlit) to front (dark), each a wavy crest.
const HILLS = [
  { base: HORIZON + 0.0, amp: 0.025, freq: 7.0, phase: 0.6, color: [0.5, 0.52, 0.3] },
  { base: HORIZON + 0.12, amp: 0.035, freq: 4.3, phase: 2.1, color: [0.28, 0.4, 0.18] },
  { base: HORIZON + 0.26, amp: 0.045, freq: 3.1, phase: 0.2, color: [0.14, 0.23, 0.1] },
];

function buildSample() {
  const buf = Buffer.alloc(TW * TH * 3);
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const fx = x / (TW - 1);
      const fy = y / (TH - 1);
      let rgb;
      if (fy < HORIZON) {
        rgb = skyAt(fx, fy);
      } else {
        rgb = null;
        // Pick the front-most hill layer whose crest is above this point.
        for (let i = HILLS.length - 1; i >= 0; i--) {
          const h = HILLS[i];
          const top = h.base + h.amp * Math.sin(fx * h.freq + h.phase) + h.amp * 0.5 * Math.sin(fx * h.freq * 2.3);
          if (fy >= top) {
            const depth = smooth((fy - top) / 0.5); // darken down the slope
            let c = mix3(h.color, [h.color[0] * 0.45, h.color[1] * 0.45, h.color[2] * 0.45], depth);
            if (i === 0) {
              // Warm side-light on the back hill, falling off away from the sun.
              const warm = Math.exp(-((fx - SUN_X) ** 2) / (2 * 0.3 * 0.3)) * 0.35;
              c = [c[0] + warm * 0.5, c[1] + warm * 0.35, c[2] + warm * 0.1];
            }
            rgb = c;
            break;
          }
        }
        if (!rgb) rgb = mix3(SKY_HORIZON, [0.6, 0.55, 0.35], 0.5); // thin horizon haze
      }
      const grain = (hash(x, y) - 0.5) * 0.03;
      const o = (y * TW + x) * 3;
      buf[o] = Math.round(clamp01(rgb[0] + grain) * 255);
      buf[o + 1] = Math.round(clamp01(rgb[1] + grain) * 255);
      buf[o + 2] = Math.round(clamp01(rgb[2] + grain) * 255);
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
