export type AspectRatioId = '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | '21:9';

export type AspectMode = 'fill' | 'fit';

export interface AspectRatioOption {
  id: AspectRatioId;
  label: string;
  hint: string;
  ratio: number;
}

/** A placement rectangle on the output canvas, as fractions (0..1). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_RECT: Rect = { x: 0, y: 0, w: 1, h: 1 };

export type MediaKind = 'video' | 'image';

export interface MediaItem {
  id: string;
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  size: number;
  /** seconds (0 for images). */
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  /** object URL (runtime only, not persisted). */
  url: string;
  /** source bytes (runtime only, persisted separately in IndexedDB). */
  blob: Blob;
}

export type MediaMeta = Omit<MediaItem, 'url' | 'blob'>;

export interface Track {
  id: string;
  name: string;
  hidden: boolean;
  muted: boolean;
}

/**
 * A clip placed on a track. `start` is its timeline position (seconds); `in`/`out`
 * are the trimmed source range. Timeline length is (out-in)/speed. `rect` places
 * it on the output canvas (fractions); `opacity` 0..1.
 */
export interface Clip {
  id: string;
  mediaId: string;
  trackId: string;
  start: number;
  in: number;
  out: number;
  speed: number;
  rect: Rect;
  opacity: number;
  muted: boolean;
  hidden: boolean;
}

export type ExportFormat = 'mp4' | 'webm' | 'gif';
export type ExportQuality = 'high' | 'medium' | 'low';

export interface ExportSettings {
  format: ExportFormat;
  quality: ExportQuality;
}

export interface ProjectSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  media: MediaMeta[];
  tracks: Track[];
  clips: Clip[];
  aspect: AspectRatioId;
  aspectMode: AspectMode;
  muted: boolean;
  exportSettings: ExportSettings;
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: '16:9', label: '16:9', hint: 'Widescreen', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', hint: 'Reels / TikTok', ratio: 9 / 16 },
  { id: '1:1', label: '1:1', hint: 'Square', ratio: 1 },
  { id: '4:5', label: '4:5', hint: 'Portrait', ratio: 4 / 5 },
  { id: '4:3', label: '4:3', hint: 'Classic', ratio: 4 / 3 },
  { id: '21:9', label: '21:9', hint: 'Cinematic', ratio: 21 / 9 },
];

export const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 4] as const;

export function aspectById(id: AspectRatioId): AspectRatioOption {
  return ASPECT_RATIOS.find((a) => a.id === id) ?? ASPECT_RATIOS[0];
}

/** Output canvas pixel size for an aspect ratio (longest side ~1280, even). */
export function canvasSize(ratio: number): { width: number; height: number } {
  const long = 1280;
  let w: number;
  let h: number;
  if (ratio >= 1) {
    w = long;
    h = Math.round(long / ratio);
  } else {
    h = long;
    w = Math.round(long * ratio);
  }
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(w), height: even(h) };
}
