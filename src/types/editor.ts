export type AspectRatioId =
  | 'original'
  | '16:9'
  | '9:16'
  | '1:1'
  | '4:5'
  | '4:3'
  | '21:9';

/** How a target aspect ratio is reached: crop to fill, or letterbox to fit. */
export type AspectMode = 'fill' | 'fit';

export interface AspectRatioOption {
  id: AspectRatioId;
  label: string;
  hint: string;
  /** width / height, or null for the source's native ratio. */
  ratio: number | null;
}

/** Crop rectangle expressed as fractions (0..1) of the source frame. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A kept portion of the source, in source-seconds. */
export interface Segment {
  id: string;
  start: number;
  end: number;
}

export interface SourceMeta {
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
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
  source: SourceMeta;
  segments: Segment[];
  speed: number;
  muted: boolean;
  crop: CropRect | null;
  aspect: AspectRatioId;
  aspectMode: AspectMode;
  exportSettings: ExportSettings;
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
  { id: 'original', label: 'Original', hint: 'Keep source', ratio: null },
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
