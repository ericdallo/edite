// Generates the bundled .cube LUT looks into public/luts/.
// Self-authored, deterministic color grades (CC0). Re-run with `node scripts/gen-luts.mjs`.
// Each look is a pure (r,g,b in 0..1) -> (r,g,b) function baked into a 17^3 cube.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 17;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'luts');

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

const LOOKS = [
  {
    id: 'cinematic',
    title: 'Cinematic',
    category: 'Movies',
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
    id: 'faded',
    title: 'Faded',
    category: 'Retro',
    fn: (r, g, b) => {
      // Lifted matte blacks, low contrast, warm-yellow cast, washed colour.
      let rr = lift(contrast(r * 1.03, 0.88), 0.08);
      let gg = lift(contrast(g * 1.01, 0.88), 0.07);
      let bb = lift(contrast(b * 0.95, 0.88), 0.05);
      return saturate([rr, gg, bb], 0.82);
    },
  },
  {
    id: 'vivid',
    title: 'Vivid',
    category: 'Landscape',
    fn: (r, g, b) => {
      let [rr, gg, bb] = saturate([r, g, b], 1.32);
      rr = contrast(rr, 1.08);
      gg = contrast(gg, 1.08);
      bb = contrast(bb * 1.03, 1.08); // cooler sky
      return [rr, gg, bb];
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
    id: 'moody',
    title: 'Moody',
    category: 'Life',
    fn: (r, g, b) => {
      // Cool, crushed, desaturated.
      let rr = Math.pow(clamp01(r * 0.97), 1.08);
      let gg = Math.pow(clamp01(g), 1.06);
      let bb = Math.pow(clamp01(b * 1.06), 1.04);
      return saturate([contrast(rr, 1.1), contrast(gg, 1.1), contrast(bb, 1.1)], 0.9);
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

mkdirSync(OUT, { recursive: true });
for (const look of LOOKS) {
  const file = join(OUT, `${look.id}.cube`);
  writeFileSync(file, buildCube(look));
  console.log(`[gen-luts] ${look.id}.cube (${look.category})`);
}
console.log(`[gen-luts] wrote ${LOOKS.length} looks to public/luts/`);
