import type { ChromaKey } from '@/types/editor';

/** Parse a #rrggbb string into RGB components in the 0..1 range (defaults to green). */
export function hexToRgb01(hex: string): [number, number, number] {
  const h = (hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 1, 0];
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

/** `0xRRGGBB` form for ffmpeg color args (falls back to green). */
function chromaColorArg(hex: string): string {
  const h = (hex || '').replace('#', '').trim();
  return /^[0-9a-fA-F]{6}$/.test(h) ? `0x${h.toLowerCase()}` : '0x00ff00';
}

/**
 * ffmpeg `chromakey` filter for a keyed clip, or '' when absent. similarity and
 * blend are clamped to ffmpeg's valid ranges; the same numeric values drive the
 * preview shader so the look stays close.
 */
export function ffmpegChromaFilter(ck?: ChromaKey | null): string {
  if (!ck) return '';
  const sim = Math.min(1, Math.max(0.01, ck.similarity)).toFixed(3);
  const blend = Math.min(1, Math.max(0, ck.blend)).toFixed(3);
  return `chromakey=${chromaColorArg(ck.color)}:${sim}:${blend}`;
}
