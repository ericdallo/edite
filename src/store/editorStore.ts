import { create } from 'zustand';
import {
  type AspectMode,
  type AspectRatioId,
  type Clip,
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
  FULL_RECT,
  type MediaItem,
  type Rect,
  type Track,
} from '@/types/editor';
import { clipEnd, clipSourceAt, projectDuration } from '@/lib/timeline';

export type ToolId = 'media' | 'transform' | 'speed' | 'aspect' | 'audio';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const MIN_CLIP = 0.06;
const IMAGE_DEFAULT_DUR = 3;
const DEFAULT_EXPORT: ExportSettings = DEFAULT_EXPORT_SETTINGS;
const HISTORY_LIMIT = 100;

/** The subset of state that undo/redo tracks (the "document"). */
interface DocSnapshot {
  media: MediaItem[];
  tracks: Track[];
  clips: Clip[];
  aspect: AspectRatioId;
  aspectMode: AspectMode;
  muted: boolean;
  projectName: string;
}

function snapshotDoc(s: DocSnapshot): DocSnapshot {
  return {
    media: s.media,
    tracks: s.tracks,
    clips: s.clips,
    aspect: s.aspect,
    aspectMode: s.aspectMode,
    muted: s.muted,
    projectName: s.projectName,
  };
}

// All store updates are immutable, so reference equality is an exact change test.
function sameDoc(a: DocSnapshot, b: DocSnapshot): boolean {
  return (
    a.media === b.media &&
    a.tracks === b.tracks &&
    a.clips === b.clips &&
    a.aspect === b.aspect &&
    a.aspectMode === b.aspectMode &&
    a.muted === b.muted &&
    a.projectName === b.projectName
  );
}

function emptyDoc(projectName = 'Untitled project'): DocSnapshot {
  return { media: [], tracks: [], clips: [], aspect: '16:9', aspectMode: 'fill', muted: false, projectName };
}

export const selectDoc = (s: DocSnapshot): DocSnapshot => snapshotDoc(s);
export const docsEqual = sameDoc;

interface PlaybackState {
  currentTime: number;
  playing: boolean;
  volume: number;
}

export interface EditorState {
  projectId: string;
  projectName: string;

  media: MediaItem[];
  tracks: Track[];
  clips: Clip[];

  aspect: AspectRatioId;
  aspectMode: AspectMode;
  muted: boolean;
  exportSettings: ExportSettings;

  activeClipId: string | null;
  clipboard: Clip | null;

  past: DocSnapshot[];
  future: DocSnapshot[];
  committed: DocSnapshot;

  playback: PlaybackState;
  selectedTool: ToolId;
  zoom: number;
  snap: boolean;
  isExporting: boolean;
  exportProgress: number;
  exportStage: string;

  newProject: (args: { id?: string; name?: string }) => void;
  closeProject: () => void;
  setProjectName: (name: string) => void;
  setSelectedTool: (tool: ToolId) => void;

  addMedia: (item: MediaItem) => void;
  addClipFromMedia: (mediaId: string, opts?: { trackId?: string; start?: number }) => void;

  addTrack: () => string;
  removeTrack: (id: string) => void;
  setTrackMuted: (id: string, muted: boolean) => void;
  setTrackHidden: (id: string, hidden: boolean) => void;

  updateClip: (id: string, patch: Partial<Clip>) => void;
  moveClip: (id: string, start: number, trackId: string) => void;
  moveClipToNewTrack: (id: string, start: number, edge: 'above' | 'below') => void;
  splitAt: (timelineTime: number) => void;
  duplicateClip: (id: string) => void;
  copyClip: (id: string) => void;
  pasteClip: (timelineTime?: number) => void;
  deleteClip: (id: string) => void;
  toggleClipMuted: (id: string) => void;
  toggleClipHidden: (id: string) => void;
  setClipRect: (id: string, rect: Rect) => void;
  setClipOpacity: (id: string, opacity: number) => void;
  setClipSpeed: (id: string, speed: number) => void;
  setActiveClip: (id: string | null) => void;

  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setVolume: (v: number) => void;

  setAspect: (a: AspectRatioId) => void;
  setAspectMode: (m: AspectMode) => void;
  setMuted: (m: boolean) => void;
  toggleMute: () => void;
  setExportSettings: (s: Partial<ExportSettings>) => void;

  setZoom: (z: number) => void;
  toggleSnap: () => void;
  setExporting: (v: boolean) => void;
  setExportProgress: (p: number, stage?: string) => void;

  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  hydrate: (partial: Partial<EditorState>) => void;
}

function mediaFor(state: EditorState, mediaId: string): MediaItem | undefined {
  return state.media.find((m) => m.id === mediaId);
}

function clampClip(c: Clip, media: MediaItem | undefined): Clip {
  const isVideo = media?.kind === 'video';
  const maxOut = isVideo ? media!.duration : Number.POSITIVE_INFINITY;
  const inUpper = isVideo ? Math.max(0, media!.duration - MIN_CLIP) : Math.max(0, c.out - MIN_CLIP);
  const nin = clamp(c.in, 0, inUpper);
  const nout = clamp(c.out, nin + MIN_CLIP, maxOut);
  return {
    ...c,
    start: Math.max(0, c.start),
    in: nin,
    out: nout,
    speed: clamp(c.speed, 0.1, 16),
    opacity: clamp(c.opacity, 0, 1),
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: '',
  projectName: 'Untitled project',
  media: [],
  tracks: [],
  clips: [],
  aspect: '16:9',
  aspectMode: 'fill',
  muted: false,
  exportSettings: DEFAULT_EXPORT,
  activeClipId: null,
  clipboard: null,
  past: [],
  future: [],
  committed: emptyDoc(),
  playback: { currentTime: 0, playing: false, volume: 1 },
  selectedTool: 'media',
  zoom: 1,
  snap: true,
  isExporting: false,
  exportProgress: 0,
  exportStage: '',

  newProject: ({ id, name }) =>
    set((s) => {
      for (const m of s.media) URL.revokeObjectURL(m.url);
      return {
        projectId: id ?? uid(),
        projectName: name ?? 'Untitled project',
        media: [],
        tracks: [],
        clips: [],
        aspect: '16:9',
        aspectMode: 'fill',
        muted: false,
        activeClipId: null,
        clipboard: null,
        past: [],
        future: [],
        committed: emptyDoc(name ?? 'Untitled project'),
        playback: { currentTime: 0, playing: false, volume: s.playback.volume },
        selectedTool: 'media',
        zoom: 1,
        isExporting: false,
        exportProgress: 0,
        exportStage: '',
      };
    }),

  closeProject: () =>
    set((s) => {
      for (const m of s.media) URL.revokeObjectURL(m.url);
      return {
        projectId: '',
        projectName: 'Untitled project',
        media: [],
        tracks: [],
        clips: [],
        activeClipId: null,
        clipboard: null,
        past: [],
        future: [],
        committed: emptyDoc(),
        playback: { currentTime: 0, playing: false, volume: s.playback.volume },
      };
    }),

  setProjectName: (name) => set({ projectName: name }),
  setSelectedTool: (tool) => set({ selectedTool: tool }),

  addMedia: (item) => set((s) => ({ media: [...s.media, item] })),

  addClipFromMedia: (mediaId, opts) =>
    set((state) => {
      const m = mediaFor(state, mediaId);
      if (!m) return {};
      let tracks = state.tracks;
      let trackId = opts?.trackId;
      if (!trackId) {
        const t: Track = { id: uid(), name: `Track ${tracks.length + 1}`, hidden: false, muted: false };
        tracks = [...tracks, t];
        trackId = t.id;
      }
      const out = m.kind === 'image' ? IMAGE_DEFAULT_DUR : m.duration;
      const clip: Clip = {
        id: uid(),
        mediaId,
        trackId,
        start: Math.max(0, opts?.start ?? 0),
        in: 0,
        out,
        speed: 1,
        rect: { ...FULL_RECT },
        opacity: 1,
        muted: false,
        hidden: false,
      };
      return { tracks, clips: [...state.clips, clip], activeClipId: clip.id };
    }),

  addTrack: () => {
    const t: Track = { id: uid(), name: `Track ${get().tracks.length + 1}`, hidden: false, muted: false };
    set((s) => ({ tracks: [...s.tracks, t] }));
    return t.id;
  },

  removeTrack: (id) =>
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== id),
      clips: s.clips.filter((c) => c.trackId !== id),
    })),

  setTrackMuted: (id, muted) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, muted } : t)) })),
  setTrackHidden: (id, hidden) =>
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, hidden } : t)) })),

  updateClip: (id, patch) =>
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === id ? clampClip({ ...c, ...patch }, mediaFor(state, c.mediaId)) : c,
      ),
    })),

  moveClip: (id, start, trackId) =>
    set((state) => {
      const exists = state.tracks.some((t) => t.id === trackId);
      return {
        clips: state.clips.map((c) =>
          c.id === id ? { ...c, start: Math.max(0, start), trackId: exists ? trackId : c.trackId } : c,
        ),
      };
    }),

  moveClipToNewTrack: (id, start, edge) =>
    set((state) => {
      const t: Track = { id: uid(), name: `Track ${state.tracks.length + 1}`, hidden: false, muted: false };
      const tracks = edge === 'below' ? [t, ...state.tracks] : [...state.tracks, t];
      const clips = state.clips.map((c) =>
        c.id === id ? { ...c, start: Math.max(0, start), trackId: t.id } : c,
      );
      return { tracks, clips, activeClipId: id };
    }),

  splitAt: (t) =>
    set((state) => {
      const within = (c: Clip) => t > c.start + MIN_CLIP && t < clipEnd(c) - MIN_CLIP && !c.hidden;
      let clip = state.activeClipId ? state.clips.find((c) => c.id === state.activeClipId) : undefined;
      if (!clip || !within(clip)) clip = [...state.clips].reverse().find(within);
      if (!clip || !within(clip)) return {};
      const srcT = clipSourceAt(clip, t);
      const left: Clip = { ...clip, id: uid(), out: srcT };
      const right: Clip = { ...clip, id: uid(), start: t, in: srcT };
      const clips = state.clips.flatMap((c) => (c.id === clip!.id ? [left, right] : [c]));
      return { clips, activeClipId: right.id };
    }),

  duplicateClip: (id) =>
    set((state) => {
      const c = state.clips.find((x) => x.id === id);
      if (!c) return {};
      const copy: Clip = { ...c, id: uid(), start: clipEnd(c) };
      return { clips: [...state.clips, copy], activeClipId: copy.id };
    }),

  copyClip: (id) =>
    set((state) => {
      const c = state.clips.find((x) => x.id === id);
      return c ? { clipboard: { ...c } } : {};
    }),

  pasteClip: (t) =>
    set((state) => {
      if (!state.clipboard) return {};
      const trackOk = state.tracks.some((tr) => tr.id === state.clipboard!.trackId);
      const trackId = trackOk ? state.clipboard.trackId : state.tracks[state.tracks.length - 1]?.id;
      if (!trackId) return {};
      const copy: Clip = {
        ...state.clipboard,
        id: uid(),
        trackId,
        start: Math.max(0, t ?? state.playback.currentTime),
      };
      return { clips: [...state.clips, copy], activeClipId: copy.id };
    }),

  deleteClip: (id) =>
    set((state) => {
      const idx = state.clips.findIndex((c) => c.id === id);
      const clips = state.clips.filter((c) => c.id !== id);
      const activeClipId =
        state.activeClipId === id ? clips[Math.min(idx, clips.length - 1)]?.id ?? null : state.activeClipId;
      return { clips, activeClipId };
    }),

  toggleClipMuted: (id) =>
    set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, muted: !c.muted } : c)) })),
  toggleClipHidden: (id) =>
    set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)) })),

  setClipRect: (id, rect) => get().updateClip(id, { rect }),
  setClipOpacity: (id, opacity) => get().updateClip(id, { opacity }),
  setClipSpeed: (id, speed) => get().updateClip(id, { speed }),
  setActiveClip: (id) => set({ activeClipId: id }),

  setCurrentTime: (t) => set((s) => ({ playback: { ...s.playback, currentTime: Math.max(0, t) } })),
  setPlaying: (p) => set((s) => ({ playback: { ...s.playback, playing: p } })),
  setVolume: (v) => set((s) => ({ playback: { ...s.playback, volume: clamp(v, 0, 1) } })),

  setAspect: (a) => set({ aspect: a }),
  setAspectMode: (m) => set({ aspectMode: m }),
  setMuted: (m) => set({ muted: m }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setExportSettings: (s) => set((st) => ({ exportSettings: { ...st.exportSettings, ...s } })),

  setZoom: (z) => set({ zoom: clamp(z, 0.25, 12) }),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  setExporting: (v) => set({ isExporting: v }),
  setExportProgress: (p, stage) =>
    set((s) => ({ exportProgress: clamp(p, 0, 1), exportStage: stage ?? s.exportStage })),

  commitHistory: () =>
    set((s) => {
      const cur = snapshotDoc(s);
      if (sameDoc(cur, s.committed)) return {};
      return { past: [...s.past, s.committed].slice(-HISTORY_LIMIT), future: [], committed: cur };
    }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return {};
      const prev = s.past[s.past.length - 1];
      const cur = snapshotDoc(s);
      const activeClipId = prev.clips.some((c) => c.id === s.activeClipId) ? s.activeClipId : null;
      return {
        ...prev,
        past: s.past.slice(0, -1),
        future: [cur, ...s.future].slice(0, HISTORY_LIMIT),
        committed: prev,
        activeClipId,
        playback: { ...s.playback, playing: false, currentTime: clamp(s.playback.currentTime, 0, projectDuration(prev.clips)) },
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {};
      const next = s.future[0];
      const cur = snapshotDoc(s);
      const activeClipId = next.clips.some((c) => c.id === s.activeClipId) ? s.activeClipId : null;
      return {
        ...next,
        past: [...s.past, cur].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        committed: next,
        activeClipId,
        playback: { ...s.playback, playing: false, currentTime: clamp(s.playback.currentTime, 0, projectDuration(next.clips)) },
      };
    }),

  hydrate: (partial) =>
    set((s) => {
      const merged = { ...s, ...partial };
      return { ...partial, past: [], future: [], committed: snapshotDoc(merged) };
    }),
}));
