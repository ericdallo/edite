import type { Rect, TextStyle } from '@/types/editor';
import { drawText } from './render';

/** Even pixel size, matching the export command's canvas rounding so no rescale happens. */
const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2);

/**
 * Rasterize a text overlay to a transparent PNG sized to its box at the export
 * resolution. ffmpeg overlays this PNG directly, so the export matches the
 * preview pixel for pixel.
 */
export async function renderTextToBlob(
  style: TextStyle,
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
  if (!ctx) throw new Error('Could not get a 2D canvas context for text rendering.');

  try {
    await document.fonts.ready;
  } catch {
    // the Font Loading API is optional; web-safe fonts are always available
  }

  drawText(ctx, style, { boxW: w, boxH: h, canvasH });

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Text rasterization failed.'))),
      'image/png',
    );
  });
}
