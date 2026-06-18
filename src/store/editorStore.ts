import { create } from 'zustand';
import type {
  AspectMode,
  AspectRatioId,
  CropRect,
  ExportSettings,
  Segment,
  SourceMeta,
} from '@/types/editor';

export type ToolId = 'trim' | 'split' | 'crop' | 'speed' | 'aspect' | 'mute';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

interface PlaybackState {
  currentTime: number;
  playing: boolean;
  volume: number;
}

const DEFAULT_EXPORT: ExportSettings = { format: 'mp4', quality: 'high' };

export interface EditorState {
  projectId: string;
  projectName: string;

  source: SourceMeta | null;
  sourceUrl: string | null;
  sourceBlob: Blob | null;

  segments: Segment[];
  activeSegmentId: string | null;

  speed: number;
  muted: boolean;
  crop: CropRect | null;
  aspect: AspectRatioId;
  aspectMode: AspectMode;
  exportSettings: ExportSettings;

  playback: PlaybackState;

  selectedTool: ToolId;
  zoom: number;
  isExporting: boolean;
  exportProgress: number;
  exportStage: string;

  loadSource: (args: {
    meta: SourceMeta;
    url: string;
    blob: Blob;
    name: string;
    id?: string;
  }) => void;
  closeProject: () => void;
  setProjectName: (name: string) => void;
  setSelectedTool: (tool: ToolId) => void;

  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setVolume: (v: number) => void;

  splitAt: (sourceTime: number) => void;
  trimSegment: (id: string, start: number, end: number) => void;
  deleteSegment: (id: string) => void;
  setActiveSegment: (id: string | null) => void;
  resetSegments: () => void;

  setSpeed: (s: number) => void;
  setMuted: (m: boolean) => void;
  toggleMute: () => void;
  setCrop: (c: CropRect | null) => void;
  setAspect: (a: AspectRatioId) => void;
  setAspectMode: (m: AspectMode) => void;
  setExportSettings: (s: Partial<ExportSettings>) => void;

  setZoom: (z: number) => void;
  setExporting: (v: boolean) => void;
  setExportProgress: (p: number, stage?: string) => void;

  hydrate: (partial: Partial<EditorState>) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: '',
  projectName: 'Untitled project',
  source: null,
  sourceUrl: null,
  sourceBlob: null,
  segments: [],
  activeSegmentId: null,
  speed: 1,
  muted: false,
  crop: null,
  aspect: 'original',
  aspectMode: 'fill',
  exportSettings: DEFAULT_EXPORT,
  playback: { currentTime: 0, playing: false, volume: 1 },
  selectedTool: 'trim',
  zoom: 1,
  isExporting: false,
  exportProgress: 0,
  exportStage: '',

  loadSource: ({ meta, url, blob, name, id }) => {
    const prev = get().sourceUrl;
    if (prev && prev !== url) URL.revokeObjectURL(prev);
    const seg: Segment = { id: uid(), start: 0, end: meta.duration };
    set({
      projectId: id ?? uid(),
      projectName: name.replace(/\.[^/.]+$/, '') || 'Untitled project',
      source: meta,
      sourceUrl: url,
      sourceBlob: blob,
      segments: [seg],
      activeSegmentId: seg.id,
      speed: 1,
      muted: false,
      crop: null,
      aspect: 'original',
      aspectMode: 'fill',
      playback: { currentTime: 0, playing: false, volume: get().playback.volume },
      selectedTool: 'trim',
      zoom: 1,
      isExporting: false,
      exportProgress: 0,
      exportStage: '',
    });
  },

  closeProject: () => {
    const prev = get().sourceUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({
      projectId: '',
      projectName: 'Untitled project',
      source: null,
      sourceUrl: null,
      sourceBlob: null,
      segments: [],
      activeSegmentId: null,
      speed: 1,
      muted: false,
      crop: null,
      aspect: 'original',
      aspectMode: 'fill',
      playback: { currentTime: 0, playing: false, volume: get().playback.volume },
    });
  },

  setProjectName: (name) => set({ projectName: name }),
  setSelectedTool: (tool) => set({ selectedTool: tool }),

  setCurrentTime: (t) => set((s) => ({ playback: { ...s.playback, currentTime: Math.max(0, t) } })),
  setPlaying: (p) => set((s) => ({ playback: { ...s.playback, playing: p } })),
  setVolume: (v) => set((s) => ({ playback: { ...s.playback, volume: clamp(v, 0, 1) } })),

  splitAt: (sourceTime) =>
    set((state) => {
      const seg = state.segments.find(
        (s) => sourceTime > s.start + 0.06 && sourceTime < s.end - 0.06,
      );
      if (!seg) return {};
      const left: Segment = { id: uid(), start: seg.start, end: sourceTime };
      const right: Segment = { id: uid(), start: sourceTime, end: seg.end };
      const segments = state.segments.flatMap((s) => (s.id === seg.id ? [left, right] : [s]));
      return { segments, activeSegmentId: right.id };
    }),

  trimSegment: (id, start, end) =>
    set((state) => {
      const dur = state.source?.duration ?? Number.POSITIVE_INFINITY;
      const min = 0.06;
      const segments = state.segments.map((s) => {
        if (s.id !== id) return s;
        const ns = clamp(start, 0, end - min);
        const ne = clamp(end, ns + min, dur);
        return { ...s, start: ns, end: ne };
      });
      return { segments };
    }),

  deleteSegment: (id) =>
    set((state) => {
      if (state.segments.length <= 1) return {};
      const idx = state.segments.findIndex((s) => s.id === id);
      const segments = state.segments.filter((s) => s.id !== id);
      const activeSegmentId =
        state.activeSegmentId === id
          ? segments[Math.min(idx, segments.length - 1)]?.id ?? null
          : state.activeSegmentId;
      return { segments, activeSegmentId };
    }),

  setActiveSegment: (id) => set({ activeSegmentId: id }),

  resetSegments: () =>
    set((state) => {
      if (!state.source) return {};
      const seg: Segment = { id: uid(), start: 0, end: state.source.duration };
      return { segments: [seg], activeSegmentId: seg.id };
    }),

  setSpeed: (s) => set({ speed: clamp(s, 0.1, 16) }),
  setMuted: (m) => set({ muted: m }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setCrop: (c) => set({ crop: c }),
  setAspect: (a) => set({ aspect: a }),
  setAspectMode: (m) => set({ aspectMode: m }),
  setExportSettings: (s) => set((st) => ({ exportSettings: { ...st.exportSettings, ...s } })),

  setZoom: (z) => set({ zoom: clamp(z, 0.25, 8) }),
  setExporting: (v) => set({ isExporting: v }),
  setExportProgress: (p, stage) =>
    set((s) => ({ exportProgress: clamp(p, 0, 1), exportStage: stage ?? s.exportStage })),

  hydrate: (partial) => set(partial),
}));
