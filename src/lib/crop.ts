import type { CSSProperties } from 'react';
import { type Rect, isFullRect } from '@/types/editor';
import { clamp } from '@/lib/utils';

/**
 * Clamp a source-crop rect to a valid sub-rectangle of the frame, returning
 * undefined when it covers the whole frame (so an "uncropped" clip stays clean
 * and old projects are unaffected).
 */
export function clampCrop(r: Rect): Rect | undefined {
  const x = clamp(r.x, 0, 0.95);
  const y = clamp(r.y, 0, 0.95);
  const w = clamp(r.w, 0.05, 1 - x);
  const h = clamp(r.h, 0.05, 1 - y);
  const out = { x, y, w, h };
  return isFullRect(out) ? undefined : out;
}

/**
 * CSS to show only a clip's cropped source region, cover-filling its box, exactly
 * like the export's `crop=…` before the cover scale. The full media element is
 * scaled so the (oriented) crop region covers the box and translated so the
 * region's centre sits at the box centre; flips/rotation are folded into one
 * transform around that centre (matching the export's crop → flip → rotate →
 * cover order). Returns undefined when there's no crop (caller keeps object-cover).
 */
export function cropMediaStyle(
  crop: Rect | null | undefined,
  boxW: number,
  boxH: number,
  srcW: number,
  srcH: number,
  rotation = 0,
  flipH = false,
  flipV = false,
): CSSProperties | undefined {
  if (isFullRect(crop) || boxW <= 0 || boxH <= 0 || srcW <= 0 || srcH <= 0) return undefined;
  const c = crop as Rect;
  const rot = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
  const regionW = c.w * srcW;
  const regionH = c.h * srcH;
  // The crop region's oriented dimensions (90/270 swap width and height).
  const swap = rot === 90 || rot === 270;
  const orientedW = swap ? regionH : regionW;
  const orientedH = swap ? regionW : regionH;
  // Source→display scale so the oriented region covers the box.
  const s = Math.max(boxW / orientedW, boxH / orientedH);
  // The crop region's centre in the (un-rotated) element's local px.
  const originX = s * (c.x + c.w / 2) * srcW;
  const originY = s * (c.y + c.h / 2) * srcH;
  return {
    position: 'absolute',
    left: `${boxW / 2 - originX}px`,
    top: `${boxH / 2 - originY}px`,
    width: `${s * srcW}px`,
    height: `${s * srcH}px`,
    maxWidth: 'none',
    transform: `rotate(${rot}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
    transformOrigin: `${originX}px ${originY}px`,
  };
}
