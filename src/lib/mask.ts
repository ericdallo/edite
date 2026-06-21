import type { CSSProperties } from 'react';
import type { ClipMask } from '@/types/editor';

const clampNum = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** A mask is engaged whenever the field is present. */
export function isNeutralMask(m?: ClipMask | null): boolean {
  return m == null;
}

/** Clamp a mask's geometry to sane ranges (centre/size in the box, angle 0..360). */
export function clampMask(m: ClipMask): ClipMask {
  return {
    shape: m.shape,
    x: clampNum(m.x, 0, 1),
    y: clampNum(m.y, 0, 1),
    size: clampNum(m.size, 0.01, 1),
    angle: ((m.angle % 360) + 360) % 360,
    feather: clampNum(m.feather, 0, 100),
    invert: !!m.invert,
  };
}

/** True when two masks match (absent = no mask). */
export function maskEquals(a?: ClipMask | null, b?: ClipMask | null): boolean {
  if (!a || !b) return !a && !b;
  return (
    a.shape === b.shape &&
    Math.abs(a.x - b.x) < 1e-3 &&
    Math.abs(a.y - b.y) < 1e-3 &&
    Math.abs(a.size - b.size) < 1e-3 &&
    Math.abs(a.angle - b.angle) < 1e-3 &&
    Math.abs(a.feather - b.feather) < 1e-3 &&
    !!a.invert === !!b.invert
  );
}

/** Edge softness as a box fraction, with a small floor so the edge never divides by zero. */
function feather(m: ClipMask): number {
  return Math.max(0.004, m.feather / 100);
}

const gn = (n: number): string => n.toFixed(5);

/**
 * The mask's alpha as an ffmpeg `geq` expression in [0,1] over `X,Y` with the
 * frame's `W,H`. The exact same geometry drives the CSS preview ({@link maskCssStyle}),
 * so what you see is what burns. Circle / linear measure in pixel space (true
 * circle, true angle); rectangle is a product of two feathered 1D bands, which
 * is what a CSS `mask-composite: intersect` of two gradients computes.
 */
export function maskAlphaExpr(m: ClipMask): string {
  const f = feather(m);
  let a: string;
  if (m.shape === 'circle') {
    // 1 inside the radius, ramping to 0 over the feather band (a true circle).
    a = `1-clip((hypot(X-${gn(m.x)}*W,Y-${gn(m.y)}*H)-${gn(m.size)}*min(W,H))/(${gn(f)}*min(W,H)),0,1)`;
  } else if (m.shape === 'rectangle') {
    const xl = gn(m.x - m.size - f);
    const xr = gn(m.x + m.size + f);
    const yl = gn(m.y - m.size - f);
    const yr = gn(m.y + m.size + f);
    a =
      `clip((X/W-${xl})/${gn(f)},0,1)*clip((${xr}-X/W)/${gn(f)},0,1)` +
      `*clip((Y/H-${yl})/${gn(f)},0,1)*clip((${yr}-Y/H)/${gn(f)},0,1)`;
  } else {
    const rad = (m.angle * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    // Signed distance to the line through (x,y); keep the side where it's < 0.
    a = `clip(0.5-((X-${gn(m.x)}*W)*${gn(dx)}+(Y-${gn(m.y)}*H)*${gn(dy)})/(${gn(f)}*hypot(W,H)),0,1)`;
  }
  return m.invert ? `(1-(${a}))` : `(${a})`;
}

const p = (n: number): string => `${(n * 100).toFixed(2)}%`;

/**
 * CSS `mask` properties that reproduce {@link maskAlphaExpr} in the live preview.
 * `boxW`/`boxH` are the clip's displayed size in px (so the circle radius and the
 * linear edge land where the export's pixel-space `geq` puts them). Black = keep,
 * transparent = hide; `invert` swaps the two.
 */
export function maskCssStyle(m: ClipMask, boxW: number, boxH: number): CSSProperties {
  const f = feather(m);
  const keep = '#000';
  const hide = 'transparent';
  const a = m.invert ? hide : keep;
  const b = m.invert ? keep : hide;
  const base: CSSProperties = { maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' };

  if (m.shape === 'circle') {
    const minBox = Math.min(boxW, boxH);
    const rOut = Math.max(1, (m.size + f) * minBox);
    const inner = `${((m.size / (m.size + f)) * 100).toFixed(2)}%`;
    const img = `radial-gradient(circle ${rOut.toFixed(2)}px at ${p(m.x)} ${p(m.y)}, ${a} ${inner}, ${b} 100%)`;
    return { ...base, maskImage: img, WebkitMaskImage: img };
  }

  if (m.shape === 'rectangle') {
    if (!m.invert) {
      const h = `linear-gradient(to right, ${hide} ${p(m.x - m.size - f)}, ${keep} ${p(m.x - m.size)}, ${keep} ${p(m.x + m.size)}, ${hide} ${p(m.x + m.size + f)})`;
      const v = `linear-gradient(to bottom, ${hide} ${p(m.y - m.size - f)}, ${keep} ${p(m.y - m.size)}, ${keep} ${p(m.y + m.size)}, ${hide} ${p(m.y + m.size + f)})`;
      const img = `${h}, ${v}`;
      return {
        ...base,
        maskImage: img,
        WebkitMaskImage: img,
        maskComposite: 'intersect',
        WebkitMaskComposite: 'source-in',
      };
    }
    // Inverted: hide a centred box = the union (add) of the four outer bands.
    const left = `linear-gradient(to right, ${keep} ${p(m.x - m.size - f)}, ${hide} ${p(m.x - m.size)})`;
    const right = `linear-gradient(to right, ${hide} ${p(m.x + m.size)}, ${keep} ${p(m.x + m.size + f)})`;
    const top = `linear-gradient(to bottom, ${keep} ${p(m.y - m.size - f)}, ${hide} ${p(m.y - m.size)})`;
    const bottom = `linear-gradient(to bottom, ${hide} ${p(m.y + m.size)}, ${keep} ${p(m.y + m.size + f)})`;
    const img = `${left}, ${right}, ${top}, ${bottom}`;
    return {
      ...base,
      maskImage: img,
      WebkitMaskImage: img,
      maskComposite: 'add',
      WebkitMaskComposite: 'source-over',
    };
  }

  // Linear: a single gradient along the edge direction, with stops placed so the
  // 50%-alpha line and feather width match the geq's pixel-space projection.
  const rad = (m.angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const cssAngle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const aRad = (cssAngle * Math.PI) / 180;
  const L = Math.max(1, Math.abs(boxW * Math.sin(aRad)) + Math.abs(boxH * Math.cos(aRad)));
  const fracEdge = 0.5 + ((m.x * boxW - boxW / 2) * dx + (m.y * boxH - boxH / 2) * dy) / L;
  const fw = (f * Math.hypot(boxW, boxH)) / L;
  const img = `linear-gradient(${cssAngle.toFixed(2)}deg, ${a} ${((fracEdge - fw / 2) * 100).toFixed(2)}%, ${b} ${((fracEdge + fw / 2) * 100).toFixed(2)}%)`;
  return { ...base, maskImage: img, WebkitMaskImage: img };
}
