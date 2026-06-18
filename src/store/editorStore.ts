import { create } from 'zustand';
import {
  type AspectRatioId,
  type Clip,
  DEFAULT_EXPORT_SETTINGS,
  type ExportSettings,
  FULL_RECT,
  type MediaItem,
  type Rect,
  type Track,
} from '@/types/editor';
import { clipEnd, clipSourceAt, clipTimelineDuration, projectDuration } from '@/lib/timeline';
import { clamp } from '@/lib/utils';
import { uid } from '@/lib/ids';
import {
  CLIP_SPEED_MAX,
  CLIP_SPEED_MIN,
  HISTORY_LIMIT,
  IMAGE_DEFAULT_DUR,
  MIN_CLIP,
  ZOOM_MAX,
  ZOOM_MIN,
} from '@/lib/constants';

export type ToolId = 'media' | 'transform' | 'speed' | 'aspect' | 'audio';

const DEFAULT_EXPORT: ExportSettings = DEFAULT_EXPORT_SETTINGS;

/** The subset of state that undo/redo tracks (the "document"). */
interface DocSnapshot {
  media: MediaItem[];
  tracks: Track[];
  clips: Clip[];
  aspect: AspectRatioId;
  muted: boolean;
  projectName: string;
}

function snapshotDoc(s: DocSnapshot): DocSnapshot {
  return {
    media: s.media,
    tracks: s.tracks,
    clips: s.clips,
    aspect: s.aspect,
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
    a.muted === b.muted &&
    a.projectName === b.projectName
  );
}

function emptyDoc(projectName = 'Untitled project'): DocSnapshot {
  return { media: [], tracks: [], clips: [], aspect: 'original', muted: false, projectName };
}

export const selectDoc = (s: DocSnapshot): DocSnapshot => snapshotDoc(s);
export const docsEqual = sameDoc;

interface PlaybackState {
  currentTime: number;
  playing: boolean;
  volume: number;
}

/** New start position for a single clip, used by group drag. */
export interface ClipStart {
  id: string;
  start: number;
}

export interface EditorState {
  projectId: string;
  projectName: string;

  media: MediaItem[];
  tracks: Track[];
  clips: Clip[];

  aspect: AspectRatioId;
  muted: boolean;
  exportSettings: ExportSettings;

  /** primary selection (drives the transform box, trim, split); always in `selectedIds` when set. */
  activeClipId: string | null;
  /** full selection set for bulk actions. */
  selectedIds: string[];
  clipboard: Clip[];

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
  updateClips: (ids: string[], patch: Partial<Clip>) => void;
  setClipsSpeed: (ids: string[], speed: number) => void;
  moveClip: (id: string, start: number, trackId: string) => void;
  moveClipToNewTrack: (id: string, start: number, edge: 'above' | 'below') => void;
  setClipStarts: (starts: ClipStart[]) => void;
  splitAt: (timelineTime: number) => void;
  duplicateClips: (ids: string[]) => void;
  copyClips: (ids: string[]) => void;
  pasteClips: (timelineTime?: number) => void;
  deleteClips: (ids: string[]) => void;
  setClipRect: (id: string, rect: Rect) => void;

  setActiveClip: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setVolume: (v: number) => void;

  setAspect: (a: AspectRatioId) => void;
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
    speed: clamp(c.speed, CLIP_SPEED_MIN, CLIP_SPEED_MAX),
    opacity: clamp(c.opacity, 0, 1),
  };
}

/** Single-clip selection patch keeping activeClipId and selectedIds in sync. */
function selectOne(id: string | null): { activeClipId: string | null; selectedIds: string[] } {
  return { activeClipId: id, selectedIds: id ? [id] : [] };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: '',
  projectName: 'Untitled project',
  media: [],
  tracks: [],
  clips: [],
  aspect: 'original',
  muted: false,
  exportSettings: DEFAULT_EXPORT,
  activeClipId: null,
  selectedIds: [],
  clipboard: [],
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
        aspect: 'original',
        muted: false,
        activeClipId: null,
        selectedIds: [],
        clipboard: [],
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
        selectedIds: [],
        clipboard: [],
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
      return { tracks, clips: [...state.clips, clip], ...selectOne(clip.id) };
    }),

  addTrack: () => {
    const t: Track = { id: uid(), name: `Track ${get().tracks.length + 1}`, hidden: false, muted: false };
    set((s) => ({ tracks: [...s.tracks, t] }));
    return t.id;
  },

  removeTrack: (id) =>
    set((s) => {
      const clips = s.clips.filter((c) => c.trackId !== id);
      const selectedIds = s.selectedIds.filter((cid) => clips.some((c) => c.id === cid));
      const activeClipId = selectedIds.includes(s.activeClipId ?? '') ? s.activeClipId : selectedIds.at(-1) ?? null;
      return { tracks: s.tracks.filter((t) => t.id !== id), clips, selectedIds, activeClipId };
    }),

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

  updateClips: (ids, patch) =>
    set((state) => {
      if (ids.length === 0) return {};
      const idset = new Set(ids);
      return {
        clips: state.clips.map((c) =>
          idset.has(c.id) ? clampClip({ ...c, ...patch }, mediaFor(state, c.mediaId)) : c,
        ),
      };
    }),

  setClipsSpeed: (ids, speed) =>
    set((state) => {
      if (ids.length === 0) return {};
      const idset = new Set(ids);
      let clips = state.clips.map((c) =>
        idset.has(c.id) ? clampClip({ ...c, speed }, mediaFor(state, c.mediaId)) : c,
      );
      // A speed change resizes each clip on the timeline, which would leave gaps
      // between previously back-to-back clips. Re-flow the selected clips in
      // start order, anchored at the earliest one, so they stay contiguous.
      const selected = clips.filter((c) => idset.has(c.id)).sort((a, b) => a.start - b.start);
      if (selected.length > 1) {
        const starts = new Map<string, number>();
        let cursor = selected[0].start;
        for (const c of selected) {
          starts.set(c.id, cursor);
          cursor += clipTimelineDuration(c);
        }
        clips = clips.map((c) => (starts.has(c.id) ? { ...c, start: starts.get(c.id)! } : c));
      }
      return { clips };
    }),

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
      return { tracks, clips, ...selectOne(id) };
    }),

  setClipStarts: (starts) =>
    set((state) => {
      if (starts.length === 0) return {};
      const map = new Map(starts.map((s) => [s.id, Math.max(0, s.start)]));
      return { clips: state.clips.map((c) => (map.has(c.id) ? { ...c, start: map.get(c.id)! } : c)) };
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
      return { clips, ...selectOne(right.id) };
    }),

  duplicateClips: (ids) =>
    set((state) => {
      const idset = new Set(ids);
      const toCopy = state.clips.filter((c) => idset.has(c.id));
      if (toCopy.length === 0) return {};
      const copies = toCopy.map((c) => ({ ...c, id: uid(), start: clipEnd(c) }));
      const selectedIds = copies.map((c) => c.id);
      return { clips: [...state.clips, ...copies], selectedIds, activeClipId: selectedIds.at(-1) ?? null };
    }),

  copyClips: (ids) =>
    set((state) => {
      const idset = new Set(ids);
      const clips = state.clips.filter((c) => idset.has(c.id)).map((c) => ({ ...c }));
      return clips.length ? { clipboard: clips } : {};
    }),

  pasteClips: (t) =>
    set((state) => {
      if (state.clipboard.length === 0) return {};
      const base = Math.max(0, t ?? state.playback.currentTime);
      const minStart = Math.min(...state.clipboard.map((c) => c.start));
      const offset = base - minStart;
      const lastTrack = state.tracks[state.tracks.length - 1]?.id;
      const copies: Clip[] = [];
      for (const c of state.clipboard) {
        const trackId = state.tracks.some((tr) => tr.id === c.trackId) ? c.trackId : lastTrack;
        if (!trackId) continue;
        copies.push({ ...c, id: uid(), trackId, start: Math.max(0, c.start + offset) });
      }
      if (copies.length === 0) return {};
      const selectedIds = copies.map((c) => c.id);
      return { clips: [...state.clips, ...copies], selectedIds, activeClipId: selectedIds.at(-1) ?? null };
    }),

  deleteClips: (ids) =>
    set((state) => {
      if (ids.length === 0) return {};
      const idset = new Set(ids);
      const firstIdx = state.clips.findIndex((c) => idset.has(c.id));
      const clips = state.clips.filter((c) => !idset.has(c.id));
      const next = clips[Math.min(firstIdx, clips.length - 1)]?.id ?? null;
      return { clips, ...selectOne(next) };
    }),

  setClipRect: (id, rect) => get().updateClip(id, { rect }),

  setActiveClip: (id) => set(selectOne(id)),

  toggleSelect: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id);
      const selectedIds = has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id];
      const activeClipId = has ? selectedIds.at(-1) ?? null : id;
      return { selectedIds, activeClipId };
    }),

  selectAll: () =>
    set((s) => {
      if (s.clips.length === 0) return {};
      const selectedIds = s.clips.map((c) => c.id);
      const activeClipId =
        s.activeClipId && selectedIds.includes(s.activeClipId) ? s.activeClipId : selectedIds.at(-1) ?? null;
      return { selectedIds, activeClipId };
    }),

  clearSelection: () => set(selectOne(null)),

  setCurrentTime: (t) => set((s) => ({ playback: { ...s.playback, currentTime: Math.max(0, t) } })),
  setPlaying: (p) => set((s) => ({ playback: { ...s.playback, playing: p } })),
  setVolume: (v) => set((s) => ({ playback: { ...s.playback, volume: clamp(v, 0, 1) } })),

  setAspect: (a) => set({ aspect: a }),
  setMuted: (m) => set({ muted: m }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setExportSettings: (s) => set((st) => ({ exportSettings: { ...st.exportSettings, ...s } })),

  setZoom: (z) => set({ zoom: clamp(z, ZOOM_MIN, ZOOM_MAX) }),
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
      const selectedIds = s.selectedIds.filter((id) => prev.clips.some((c) => c.id === id));
      const activeClipId = selectedIds.includes(s.activeClipId ?? '') ? s.activeClipId : selectedIds.at(-1) ?? null;
      return {
        ...prev,
        past: s.past.slice(0, -1),
        future: [cur, ...s.future].slice(0, HISTORY_LIMIT),
        committed: prev,
        selectedIds,
        activeClipId,
        playback: { ...s.playback, playing: false, currentTime: clamp(s.playback.currentTime, 0, projectDuration(prev.clips)) },
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {};
      const next = s.future[0];
      const cur = snapshotDoc(s);
      const selectedIds = s.selectedIds.filter((id) => next.clips.some((c) => c.id === id));
      const activeClipId = selectedIds.includes(s.activeClipId ?? '') ? s.activeClipId : selectedIds.at(-1) ?? null;
      return {
        ...next,
        past: [...s.past, cur].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        committed: next,
        selectedIds,
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
