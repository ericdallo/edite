import type { Rect, ShapeStyle } from '@/types/editor';
import { drawShape } from './render';

/** Even pixel size, matching the export command's canvas rounding so no rescale happens. */
const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2);

/**
 * Rasterize a shape overlay to a transparent PNG sized to its box at the export
 * resolution. ffmpeg overlays this PNG directly, so the export matches the
 * preview pixel for pixel (both go through {@link drawShape}).
 */
export async function renderShapeToBlob(
  shape: ShapeStyle,
  rect: Rect,
  canvasW: number,
  canvasH: number,
): Promise<Blob> {
  const w = even(rect.w * canvasW);
  const h = even(rect.h * canvasH);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context for shape rendering.');

  drawShape(ctx, shape, { boxW: w, boxH: h });

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Shape rasterization failed.'))),
      'image/png',
    );
  });
}
