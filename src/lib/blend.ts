import type { BlendMode } from '@/types/editor';

// Blend modes are chosen so each id maps to a value in BOTH the preview (CSS
// `mix-blend-mode`) and the export (ffmpeg `blend=all_mode`). Only the spelling
// of soft-light differs between the two targets.

/** CSS `mix-blend-mode` value for the preview. */
export function cssBlendMode(mode: BlendMode): string {
  return mode === 'softlight' ? 'soft-light' : mode;
}

/** ffmpeg `blend=all_mode` value for the export. */
export function ffmpegBlendMode(mode: BlendMode): string {
  return mode === 'softlight' ? 'softlight' : mode;
}
