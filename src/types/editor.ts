export type AspectRatioId = 'original' | '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | '21:9';

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

export type TextAlign = 'left' | 'center' | 'right';

/** Styling for a text overlay. `fontSize` is a fraction of the canvas height so it scales with resolution. */
export interface TextStyle {
  content: string;
  /** CSS font-family string, also valid for the canvas `font` shorthand. */
  fontFamily: string;
  /** fraction of canvas height (e.g. 0.1 = 10% of height). */
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  color: string;
  align: TextAlign;
  /** line spacing multiplier. */
  lineHeight: number;
  /** background box color, or null for none. */
  background: string | null;
  backgroundOpacity: number;
  shadow: boolean;
}

/**
 * A clip placed on a track. `start` is its timeline position (seconds); `in`/`out`
 * are the trimmed source range. Timeline length is (out-in)/speed. `rect` places
 * it on the output canvas (fractions); `opacity` 0..1. A clip with `text` is a
 * text overlay (it has no media and `mediaId` is empty).
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
  text?: TextStyle;
}

export function isTextClip(clip: Clip): clip is Clip & { text: TextStyle } {
  return clip.text != null;
}

export type ExportFormat = 'mp4' | 'webm' | 'gif';
export type ExportQuality = 'high' | 'medium' | 'low';
/** Target short-side resolution in pixels (e.g. 1080 renders 1080p). */
export type ExportResolution = 480 | 720 | 1080 | 1440 | 2160;
export type ExportFps = 24 | 30 | 60;

export interface ExportSettings {
  format: ExportFormat;
  quality: ExportQuality;
  resolution: ExportResolution;
  fps: ExportFps;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'mp4',
  quality: 'high',
  resolution: 1080,
  fps: 30,
};

export interface ProjectSnapshot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  media: MediaMeta[];
  tracks: Track[];
  clips: Clip[];
  aspect: AspectRatioId;
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

export interface FontOption {
  label: string;
  /** CSS font-family stack, used verbatim for both DOM and canvas rendering. */
  family: string;
}

/**
 * Curated, web-safe font stacks. They render the same in the canvas preview and
 * the canvas-rasterized export (same machine), so what you see is what you get,
 * with no network or bundled font files. Add self-hosted families here later.
 */
export const FONT_OPTIONS: FontOption[] = [
  { label: 'Inter', family: "'Inter', system-ui, sans-serif" },
  { label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet', family: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: 'Impact', family: 'Impact, Haettenschweiler, sans-serif' },
  { label: 'Georgia', family: 'Georgia, Cambria, serif' },
  { label: 'Times', family: "'Times New Roman', Times, serif" },
  { label: 'Courier', family: "'Courier New', Courier, monospace" },
  { label: 'Comic Sans', family: "'Comic Sans MS', 'Comic Sans', cursive" },
];

export const DEFAULT_TEXT_STYLE: TextStyle = {
  content: 'Your text',
  fontFamily: FONT_OPTIONS[0].family,
  fontSize: 0.1,
  fontWeight: 700,
  italic: false,
  color: '#ffffff',
  align: 'center',
  lineHeight: 1.2,
  background: null,
  backgroundOpacity: 0.5,
  shadow: true,
};

/** Default text box: a centered lower third (fractions of the canvas). */
export const DEFAULT_TEXT_RECT: Rect = { x: 0.1, y: 0.66, w: 0.8, h: 0.2 };

export interface ResolutionOption {
  id: ExportResolution;
  label: string;
  hint: string;
}

export const RESOLUTIONS: ResolutionOption[] = [
  { id: 480, label: '480p', hint: 'SD' },
  { id: 720, label: '720p', hint: 'HD' },
  { id: 1080, label: '1080p', hint: 'Full HD' },
  { id: 1440, label: '1440p', hint: '2K' },
  { id: 2160, label: '2160p', hint: '4K' },
];

export const FPS_PRESETS: ExportFps[] = [24, 30, 60];

export function aspectById(id: AspectRatioId): AspectRatioOption {
  return ASPECT_RATIOS.find((a) => a.id === id) ?? ASPECT_RATIOS[0];
}

/**
 * Numeric canvas ratio for an aspect. Fixed aspects use their preset; 'original'
 * matches the first source video (so nothing is cropped), falling back to the
 * first sized media, then 16:9.
 */
export function resolveAspectRatio(
  aspect: AspectRatioId,
  media: Pick<MediaItem, 'kind' | 'width' | 'height'>[],
): number {
  if (aspect !== 'original') return aspectById(aspect).ratio;
  const src =
    media.find((m) => m.kind === 'video' && m.width > 0 && m.height > 0) ??
    media.find((m) => m.width > 0 && m.height > 0);
  return src ? src.width / src.height : 16 / 9;
}

/** Output canvas pixel size for an aspect ratio at a target short-side resolution (even). */
export function canvasSize(ratio: number, shortSide = 1080): { width: number; height: number } {
  let w: number;
  let h: number;
  if (ratio >= 1) {
    h = shortSide;
    w = Math.round(shortSide * ratio);
  } else {
    w = shortSide;
    h = Math.round(shortSide / ratio);
  }
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(w), height: even(h) };
}
