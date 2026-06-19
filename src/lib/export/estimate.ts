import type { ExportFormat, ExportQuality } from '@/types/editor';

export interface EstimateInput {
  width: number;
  height: number;
  fps: number;
  duration: number;
  format: ExportFormat;
  quality: ExportQuality;
  /** whether an audio track is included. */
  audio: boolean;
  /** audio bitrate in kbps. */
  audioBitrate: number;
  /** explicit target video bitrate (kbps); overrides the quality heuristic. */
  videoBitrate?: number;
}

/**
 * Bits-per-pixel-per-frame for each CRF quality tier. CRF output size is content
 * dependent, so these are deliberately rough averages used only for the "~size"
 * hint; a custom bitrate makes the estimate exact.
 */
const BPP: Record<ExportQuality, number> = { high: 0.1, medium: 0.06, low: 0.035 };

/** Approximate output size in bytes for the given export settings. */
export function estimateExportBytes(i: EstimateInput): number {
  if (!Number.isFinite(i.duration) || i.duration <= 0) return 0;

  // Audio-only outputs don't depend on frame size.
  if (i.format === 'mp3') return (i.audioBitrate * 1000 * i.duration) / 8;
  if (i.format === 'wav') return 44100 * 2 * 2 * i.duration; // 16-bit stereo PCM

  if (i.width <= 0 || i.height <= 0) return 0;

  let videoKbps: number;
  if (i.videoBitrate && i.videoBitrate > 0) {
    videoKbps = i.videoBitrate;
  } else if (i.format === 'gif') {
    // Palette GIF: no real bitrate, scales with pixels × fps. Rough.
    videoKbps = (i.width * i.height * i.fps * 0.18) / 1000;
  } else {
    const efficiency = i.format === 'webm' ? 0.72 : 1; // VP9 is a touch more efficient
    videoKbps = (i.width * i.height * i.fps * BPP[i.quality] * efficiency) / 1000;
  }

  const audioKbps = i.audio && i.format !== 'gif' ? i.audioBitrate : 0;
  return ((videoKbps + audioKbps) * 1000 * i.duration) / 8;
}
