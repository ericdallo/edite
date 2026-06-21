import type { Keyframe } from '@/types/editor';

const f = (x: number): string => (Math.round(x * 1000) / 1000).toString();

function makeEven(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

/**
 * Piecewise-linear ffmpeg time expression over `t` (seconds), through the given
 * control points (sorted by `t`). Clamps to the first/last value outside the
 * range, matching `clipTransformAt`. Designed to sit inside a single-quoted
 * filter option value (e.g. `overlay=x='<expr>'`), so the commas in `if`/`lt`
 * are protected from the filtergraph parser.
 */
export function pwLinearExpr(points: { t: number; v: number }[], tvar = 't'): string {
  if (points.length === 0) return '0';
  if (points.length === 1) return f(points[0].v);
  let expr = f(points[points.length - 1].v);
  for (let i = points.length - 1; i >= 1; i--) {
    const a = points[i - 1];
    const b = points[i];
    const span = b.t - a.t;
    const seg = span <= 1e-9 ? f(b.v) : `(${f(a.v)}+(${f(b.v - a.v)})*(${tvar}-${f(a.t)})/${f(span)})`;
    expr = `if(lt(${tvar},${f(b.t)}),${seg},${expr})`;
  }
  return `if(lt(${tvar},${f(points[0].t)}),${f(points[0].v)},${expr})`;
}

export interface KeyframeExport {
  /** static cover-crop size (px) at the largest keyframe; the box's aspect is constant. */
  refW: number;
  refH: number;
  /** overlay position (px) and animated layer size (px) as `t` expressions. */
  x: string;
  y: string;
  w: string;
  h: string;
  /** animated opacity (0..1) as a `T` expression for a geq alpha; absent = none keyframed. */
  opacity?: string;
}

/**
 * Build ffmpeg time-expressions (in canvas pixels) for a clip's keyframes,
 * encoding the same piecewise-linear position + scale that `clipTransformAt`
 * drives in the live preview. Because the box keeps its aspect across keyframes,
 * a single static cover-crop to `refW`x`refH` (the largest size) plus a uniform
 * per-frame downscale reproduces the preview's `object-cover` exactly. Control
 * points sit at timeline seconds (`clipStart + at`), which is what the overlay /
 * scale `t` equals after each input's PTS is shifted to its timeline start.
 */
export function keyframeExport(
  keyframes: Keyframe[],
  canvasW: number,
  canvasH: number,
  clipStart: number,
  baseOpacity = 1,
): KeyframeExport {
  const ks = [...keyframes].sort((a, b) => a.at - b.at);
  const pts = (sel: (r: Keyframe['rect']) => number, scale: number) =>
    ks.map((k) => ({ t: clipStart + k.at, v: sel(k.rect) * scale }));
  // Opacity rides a geq alpha (the `T` time variable) only when a keyframe pins
  // it; otherwise the clip's static opacity node is used, leaving plain
  // position/scale animations byte-identical.
  const hasOpacity = ks.some((k) => k.opacity != null);
  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  return {
    refW: makeEven(Math.max(...ks.map((k) => k.rect.w)) * canvasW),
    refH: makeEven(Math.max(...ks.map((k) => k.rect.h)) * canvasH),
    x: pwLinearExpr(pts((r) => r.x, canvasW)),
    y: pwLinearExpr(pts((r) => r.y, canvasH)),
    w: pwLinearExpr(pts((r) => r.w, canvasW)),
    h: pwLinearExpr(pts((r) => r.h, canvasH)),
    opacity: hasOpacity
      ? pwLinearExpr(ks.map((k) => ({ t: clipStart + k.at, v: clamp01(k.opacity ?? baseOpacity) })), 'T')
      : undefined,
  };
}
