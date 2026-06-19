import { create } from 'zustand';
import {
  type AspectRatioId,
  CAPTION_PRESETS,
  captionRect,
  type Clip,
  DEFAULT_BACKGROUND,
  DEFAULT_EXPORT_SETTINGS,
  DEFAULT_TEXT_RECT,
  DEFAULT_TEXT_STYLE,
  type ExportSettings,
  FULL_RECT,
  type Keyframe,
  makeSpeedCurve,
  type MediaItem,
  type Rect,
  type SpeedCurveId,
  type TextStyle,
  type Track,
  type TransitionId,
} from '@/types/editor';
import {
  canMergeClips,
  clipEnd,
  clipSourceAt,
  clipTimelineDuration,
  clipTransformAt,
  maxTransitionDuration,
  prevClipOnTrack,
  projectDuration,
} from '@/lib/timeline';
import { clamp } from '@/lib/utils';
import { uid } from '@/lib/ids';
import {
  type Accent,
  applyAccent,
  applyReduceMotion,
  applyTheme,
  loadAccent,
  loadReduceMotion,
  loadTheme,
  saveAccent,
  saveReduceMotion,
  saveTheme,
  type Theme,
} from '@/lib/theme';
import { readPref, writePref } from '@/lib/prefs';
import type { CaptionModelId } from '@/lib/captions/models';
import type { CaptionClip, CaptionLength } from '@/lib/captions/segments';
import {
  AUDIO_FADE_MAX,
  CLIP_SPEED_MAX,
  CLIP_SPEED_MIN,
  CLIP_VOLUME_MAX,
  FREEZE_DEFAULT_DUR,
  HISTORY_LIMIT,
  IMAGE_DEFAULT_DUR,
  MIN_CLIP,
  TRANSITION_DEFAULT_DUR,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
} from '@/lib/constants';

export type ToolId =
  | 'media'
  | 'transform'
  | 'animation'
  | 'speed'
  | 'effects'
  | 'aspect'
  | 'audio'
  | 'text'
  | 'captions';

/** Which top-level screen is shown (the app has no router). */
export type AppView = 'editor' | 'projects';

/** Remembered starting choices for the auto-captions tool. */
export interface CaptionDefaults {
  model: CaptionModelId;
  language: string;
  length: CaptionLength;
}

const CAPTION_DEFAULTS_KEY = 'edite-caption-defaults';
const DEFAULT_ASPECT_KEY = 'edite-default-aspect';

/** Pick a sensible default caption model: accurate on WebGPU, lighter on CPU. */
function defaultCaptionModel(): CaptionModelId {
  const gpu = typeof navigator !== 'undefined' && (navigator as Navigator & { gpu?: unknown }).gpu != null;
  return gpu ? 'small' : 'base';
}

const DEFAULT_EXPORT: ExportSettings = DEFAULT_EXPORT_SETTINGS;

/** The subset of state that undo/redo tracks (the "document"). */
interface DocSnapshot {
  media: MediaItem[];
  tracks: Track[];
  clips: Clip[];
  aspect: AspectRatioId;
  background: string;
  muted: boolean;
  projectName: string;
}

function snapshotDoc(s: DocSnapshot): DocSnapshot {
  return {
    media: s.media,
    tracks: s.tracks,
    clips: s.clips,
    aspect: s.aspect,
    background: s.background,
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
    a.background === b.background &&
    a.muted === b.muted &&
    a.projectName === b.projectName
  );
}

function emptyDoc(projectName = 'Untitled project'): DocSnapshot {
  return {
    media: [],
    tracks: [],
    clips: [],
    aspect: 'original',
    background: DEFAULT_BACKGROUND,
    muted: false,
    projectName,
  };
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
  background: string;
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
  /** mobile only: whether the tool panel sheet is open. */
  panelOpen: boolean;
  /** desktop only: hide the tool rail + panel to give the preview and timeline more room. */
  sidebarCollapsed: boolean;
  /** current top-level screen (editor vs the projects manager); not persisted. */
  view: AppView;
  zoom: number;
  snap: boolean;
  /** loop playback back to the start when the playhead reaches the end. */
  loop: boolean;
  /** app color theme (global UI preference, persisted outside the project). */
  theme: Theme;
  /** brand accent colour (global UI preference). */
  accent: Accent;
  /** when true, skip the entrance animations (global UI preference). */
  reduceMotion: boolean;
  /** remembered starting choices for the auto-captions tool. */
  captionDefaults: CaptionDefaults;
  /** aspect ratio applied to newly created projects. */
  defaultAspect: AspectRatioId;
  isExporting: boolean;
  exportProgress: number;
  exportStage: string;

  newProject: (args: { id?: string; name?: string }) => void;
  closeProject: () => void;
  setProjectName: (name: string) => void;
  setSelectedTool: (tool: ToolId) => void;
  setPanelOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setView: (view: AppView) => void;

  addMedia: (item: MediaItem) => void;
  addClipFromMedia: (mediaId: string, opts?: { trackId?: string; start?: number }) => void;
  addTextClip: (opts?: { start?: number }) => void;
  /** Add auto-caption text clips on a new dedicated track (one history step). */
  addCaptionClips: (items: CaptionClip[]) => void;
  updateText: (id: string, patch: Partial<TextStyle>) => void;
  /** Restyle every caption clip at once (style + optional position rect). */
  styleCaptions: (patch: Partial<TextStyle>, rectPatch?: Partial<Rect>) => void;
  /** Merge a caption line with the next caption on the same track. */
  mergeCaptionWithNext: (id: string) => void;

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
  mergeClips: (ids: string[]) => void;
  freezeFrame: () => void;
  setClipCurve: (ids: string[], preset: SpeedCurveId | null) => void;
  setClipTransition: (id: string, type: TransitionId | null, duration?: number) => void;
  extractAudio: (id: string) => void;
  duplicateClips: (ids: string[]) => void;
  copyClips: (ids: string[]) => void;
  pasteClips: (timelineTime?: number) => void;
  deleteClips: (ids: string[]) => void;
  /** Delete clips and pull later clips on the same track left to close the gap. */
  rippleDeleteClips: (ids: string[]) => void;
  setClipRect: (id: string, rect: Rect) => void;
  /** Add (or replace) a transform keyframe at the playhead, seeded from the current rect. */
  addKeyframeAtPlayhead: (id: string) => void;
  /** Add or replace the keyframe at clip-local time `at` with `rect` (used by the canvas box). */
  upsertKeyframe: (id: string, at: number, rect: Rect) => void;
  removeKeyframe: (id: string, index: number) => void;
  clearKeyframes: (id: string) => void;

  setActiveClip: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  selectClips: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;

  setCurrentTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setVolume: (v: number) => void;

  setAspect: (a: AspectRatioId) => void;
  setBackground: (color: string) => void;
  setMuted: (m: boolean) => void;
  toggleMute: () => void;
  setExportSettings: (s: Partial<ExportSettings>) => void;

  setZoom: (z: number) => void;
  toggleSnap: () => void;
  toggleLoop: () => void;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
  setReduceMotion: (on: boolean) => void;
  setCaptionDefaults: (patch: Partial<CaptionDefaults>) => void;
  setDefaultAspect: (aspect: AspectRatioId) => void;
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
  // A frozen clip holds one frame, so its in/out is a free hold window, not a
  // source range — don't cap it to the source video's duration.
  const isVideo = media?.kind === 'video' && c.freeze == null;
  const maxOut = isVideo ? media!.duration : Number.POSITIVE_INFINITY;
  const inUpper = isVideo ? Math.max(0, media!.duration - MIN_CLIP) : Math.max(0, c.out - MIN_CLIP);
  const nin = clamp(c.in, 0, inUpper);
  const nout = clamp(c.out, nin + MIN_CLIP, maxOut);
  const nspeed = clamp(c.speed, CLIP_SPEED_MIN, CLIP_SPEED_MAX);
  // Fades live in timeline seconds, so they can't exceed the clip's on-timeline length.
  const dur = Math.max(0, (nout - nin) / Math.max(0.0001, nspeed));
  const fadeCap = Math.min(AUDIO_FADE_MAX, dur);
  const color = c.color
    ? {
        brightness: clamp(c.color.brightness, 0, 4),
        contrast: clamp(c.color.contrast, 0, 4),
        saturation: clamp(c.color.saturation, 0, 4),
        hue: clamp(c.color.hue, -180, 180),
      }
    : undefined;
  const chromaKey = c.chromaKey
    ? {
        color: c.chromaKey.color,
        similarity: clamp(c.chromaKey.similarity, 0.01, 1),
        blend: clamp(c.chromaKey.blend, 0, 1),
      }
    : undefined;
  const transition = c.transition
    ? { type: c.transition.type, duration: clamp(c.transition.duration, 0, dur) }
    : undefined;
  // Keyframes: keep `at` non-negative and sorted, and guard against a zero-size
  // box (which would break the export's scale expression).
  const keyframes =
    c.keyframes && c.keyframes.length
      ? c.keyframes
          .map((k) => ({
            at: Math.max(0, k.at),
            rect: { x: k.rect.x, y: k.rect.y, w: Math.max(0.01, k.rect.w), h: Math.max(0.01, k.rect.h) },
          }))
          .sort((a, b) => a.at - b.at)
      : undefined;
  return {
    ...c,
    start: Math.max(0, c.start),
    in: nin,
    out: nout,
    speed: nspeed,
    opacity: clamp(c.opacity, 0, 1),
    volume: clamp(c.volume ?? 1, 0, CLIP_VOLUME_MAX),
    fadeIn: clamp(c.fadeIn ?? 0, 0, fadeCap),
    fadeOut: clamp(c.fadeOut ?? 0, 0, fadeCap),
    color,
    chromaKey,
    transition,
    keyframes,
  };
}

/** Keyframes nearer than this (clip-local seconds) are treated as the same one. */
const KF_EPS = 0.02;

/** Insert or replace the keyframe at `at`, returning a new list sorted by time. */
function upsertKeyframeList(list: Keyframe[] | undefined, at: number, rect: Rect): Keyframe[] {
  const a = Math.max(0, at);
  const next = (list ?? []).filter((k) => Math.abs(k.at - a) > KF_EPS);
  next.push({ at: a, rect: { ...rect } });
  return next.sort((x, y) => x.at - y.at);
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
  background: DEFAULT_BACKGROUND,
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
  panelOpen: false,
  sidebarCollapsed: false,
  view: 'editor',
  zoom: 1,
  snap: true,
  loop: false,
  theme: loadTheme(),
  accent: loadAccent(),
  reduceMotion: loadReduceMotion(),
  captionDefaults: {
    model: defaultCaptionModel(),
    language: 'auto',
    length: 'line',
    ...readPref<Partial<CaptionDefaults>>(CAPTION_DEFAULTS_KEY, {}),
  },
  defaultAspect: readPref<AspectRatioId>(DEFAULT_ASPECT_KEY, 'original'),
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
        aspect: s.defaultAspect,
        background: DEFAULT_BACKGROUND,
        muted: false,
        activeClipId: null,
        selectedIds: [],
        clipboard: [],
        past: [],
        future: [],
        committed: emptyDoc(name ?? 'Untitled project'),
        playback: { currentTime: 0, playing: false, volume: s.playback.volume },
        selectedTool: 'media',
        panelOpen: false,
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
        background: DEFAULT_BACKGROUND,
        panelOpen: false,
        playback: { currentTime: 0, playing: false, volume: s.playback.volume },
      };
    }),

  setProjectName: (name) => set({ projectName: name }),
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setView: (view) => set({ view }),

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
        flipH: false,
        flipV: false,
        rotation: 0,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
      };
      return { tracks, clips: [...state.clips, clip], ...selectOne(clip.id) };
    }),

  addTextClip: (opts) =>
    set((state) => {
      const t: Track = { id: uid(), name: `Text ${state.tracks.length + 1}`, hidden: false, muted: false };
      const clip: Clip = {
        id: uid(),
        mediaId: '',
        trackId: t.id,
        start: Math.max(0, opts?.start ?? state.playback.currentTime),
        in: 0,
        out: IMAGE_DEFAULT_DUR,
        speed: 1,
        rect: { ...DEFAULT_TEXT_RECT },
        opacity: 1,
        muted: true,
        hidden: false,
        flipH: false,
        flipV: false,
        rotation: 0,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        text: { ...DEFAULT_TEXT_STYLE },
      };
      return {
        tracks: [...state.tracks, t],
        clips: [...state.clips, clip],
        selectedTool: 'text',
        ...selectOne(clip.id),
      };
    }),

  addCaptionClips: (items) =>
    set((state) => {
      const clean = items.filter((it) => it.text.trim().length > 0);
      if (clean.length === 0) return {};
      const track: Track = {
        id: uid(),
        name: `Captions ${state.tracks.length + 1}`,
        hidden: false,
        muted: false,
      };
      const clips: Clip[] = clean.map((it) => ({
        id: uid(),
        mediaId: '',
        trackId: track.id,
        start: Math.max(0, it.start),
        in: 0,
        out: Math.max(MIN_CLIP, it.duration),
        speed: 1,
        rect: captionRect('bottom'),
        opacity: 1,
        muted: true,
        hidden: false,
        flipH: false,
        flipV: false,
        rotation: 0,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        text: { ...DEFAULT_TEXT_STYLE, ...CAPTION_PRESETS[0].style, content: it.text },
        caption: { words: it.words },
      }));
      const selectedIds = clips.map((c) => c.id);
      return {
        tracks: [...state.tracks, track],
        clips: [...state.clips, ...clips],
        selectedIds,
        activeClipId: selectedIds.at(-1) ?? null,
      };
    }),

  updateText: (id, patch) =>
    set((state) => {
      const target = state.clips.find((c) => c.id === id);
      if (!target?.text) return {};
      const text: TextStyle = { ...target.text, ...patch };
      if (patch.fontSize !== undefined) text.fontSize = clamp(patch.fontSize, TEXT_SIZE_MIN, TEXT_SIZE_MAX);
      if (patch.backgroundOpacity !== undefined) text.backgroundOpacity = clamp(patch.backgroundOpacity, 0, 1);
      return { clips: state.clips.map((c) => (c.id === id ? { ...c, text } : c)) };
    }),

  styleCaptions: (patch, rectPatch) =>
    set((state) => {
      let changed = false;
      const clips = state.clips.map((c) => {
        if (c.caption == null || !c.text) return c;
        changed = true;
        const text: TextStyle = { ...c.text, ...patch };
        if (patch.fontSize !== undefined) text.fontSize = clamp(patch.fontSize, TEXT_SIZE_MIN, TEXT_SIZE_MAX);
        if (patch.backgroundOpacity !== undefined) text.backgroundOpacity = clamp(patch.backgroundOpacity, 0, 1);
        return { ...c, text, rect: rectPatch ? { ...c.rect, ...rectPatch } : c.rect };
      });
      return changed ? { clips } : {};
    }),

  mergeCaptionWithNext: (id) =>
    set((state) => {
      const cur = state.clips.find((c) => c.id === id);
      if (!cur || cur.caption == null || !cur.text) return {};
      const next = state.clips
        .filter((c) => c.caption != null && c.text && c.trackId === cur.trackId && c.start > cur.start + 1e-6)
        .sort((a, b) => a.start - b.start)[0];
      if (!next?.text) return {};
      // Caption clips have in=0 and speed=1, so timeline length == out.
      const nextEnd = next.start + (next.out - next.in);
      const out = Math.max(cur.out, nextEnd - cur.start);
      const gap = next.start - cur.start;
      const curWords = cur.caption.words ?? [];
      const nextWords = (next.caption?.words ?? []).map((w) => ({
        text: w.text,
        start: w.start + gap,
        end: w.end + gap,
      }));
      const content = `${cur.text.content} ${next.text.content}`.replace(/\s+/g, ' ').trim();
      const merged: Clip = {
        ...cur,
        out,
        text: { ...cur.text, content },
        caption: { words: [...curWords, ...nextWords] },
      };
      const clips = state.clips.filter((c) => c.id !== next.id).map((c) => (c.id === cur.id ? merged : c));
      return { clips, ...selectOne(cur.id) };
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
        idset.has(c.id) ? clampClip({ ...c, speed, speedCurve: undefined }, mediaFor(state, c.mediaId)) : c,
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

  mergeClips: (ids) =>
    set((state) => {
      const idset = new Set(ids);
      const sel = state.clips.filter((c) => idset.has(c.id));
      if (!canMergeClips(sel)) return {};
      const ordered = [...sel].sort((a, b) => a.start - b.start);
      const merged: Clip = { ...ordered[0], id: uid(), out: ordered[ordered.length - 1].out };
      // Replace the contiguous run with the single merged clip at the first one's slot.
      let placed = false;
      const clips = state.clips.flatMap((c) => {
        if (!idset.has(c.id)) return [c];
        if (placed) return [];
        placed = true;
        return [merged];
      });
      return { clips, ...selectOne(merged.id) };
    }),

  freezeFrame: () =>
    set((state) => {
      const t = state.playback.currentTime;
      const within = (c: Clip): boolean => {
        if (c.text || !c.mediaId || c.hidden || c.freeze != null || c.speedCurve) return false;
        if (mediaFor(state, c.mediaId)?.kind !== 'video') return false;
        return t > c.start + MIN_CLIP && t < clipEnd(c) - MIN_CLIP;
      };
      let clip = state.activeClipId ? state.clips.find((c) => c.id === state.activeClipId) : undefined;
      if (!clip || !within(clip)) clip = [...state.clips].reverse().find(within);
      if (!clip || !within(clip)) return {};
      const srcT = clipSourceAt(clip, t);
      const hold = FREEZE_DEFAULT_DUR;
      const trackEnd = clipEnd(clip);
      const left: Clip = { ...clip, id: uid(), out: srcT };
      const frozen: Clip = {
        ...clip, id: uid(), start: t, in: 0, out: hold, speed: 1, muted: true, freeze: srcT,
      };
      const right: Clip = { ...clip, id: uid(), start: t + hold, in: srcT };
      // Insert the held still and push the rest of this track right by the hold
      // so the inserted time doesn't overlap following clips.
      const clips = state.clips.flatMap((c) => {
        if (c.id === clip!.id) return [left, frozen, right];
        if (c.trackId === clip!.trackId && c.start >= trackEnd - 1e-6) {
          return [{ ...c, start: c.start + hold }];
        }
        return [c];
      });
      return { clips, ...selectOne(frozen.id) };
    }),

  setClipCurve: (ids, preset) =>
    set((state) => {
      if (ids.length === 0) return {};
      const idset = new Set(ids);
      const curve = preset ? makeSpeedCurve(preset) : undefined;
      const clips = state.clips.map((c) => {
        if (!idset.has(c.id) || c.text || c.freeze != null) return c;
        return clampClip({ ...c, speedCurve: curve }, mediaFor(state, c.mediaId));
      });
      return { clips };
    }),

  setClipTransition: (id, type, duration) =>
    set((state) => {
      const target = state.clips.find((c) => c.id === id);
      if (!target || target.text || target.audioOnly) return {};
      const prev = prevClipOnTrack(state.clips, target);
      // A transition crosses in from an adjacent (or already overlapping) predecessor.
      if (!prev || prev.text || prev.audioOnly || clipEnd(prev) < target.start - MIN_CLIP) return {};
      const maxD = maxTransitionDuration(state.clips, target);
      if (type && maxD < MIN_CLIP) return {}; // clips too short to overlap
      const dOld = target.transition?.duration ?? 0;
      const dNew = type
        ? clamp(duration ?? target.transition?.duration ?? TRANSITION_DEFAULT_DUR, MIN_CLIP, maxD)
        : 0;
      // Move this clip (and the rest of its track) by the change in overlap: left
      // to open the overlap, right to close it, keeping downstream clips in step.
      const shift = dNew - dOld;
      const startFrom = target.start;
      const clips = state.clips.map((c) => {
        if (c.trackId !== target.trackId || c.start < startFrom - 1e-6) return c;
        const start = Math.max(0, c.start - shift);
        if (c.id === target.id) return { ...c, start, transition: type ? { type, duration: dNew } : undefined };
        return { ...c, start };
      });
      return { clips };
    }),

  extractAudio: (id) =>
    set((state) => {
      const src = state.clips.find((c) => c.id === id);
      // Only a sounding video clip can be detached (not text, images, freezes,
      // or clips that are already audio-only).
      if (!src || src.text || src.audioOnly || src.freeze != null) return {};
      const m = mediaFor(state, src.mediaId);
      if (!m || m.kind !== 'video' || !m.hasAudio) return {};
      const track: Track = {
        id: uid(),
        name: `Audio ${state.tracks.length + 1}`,
        hidden: false,
        muted: false,
      };
      // Reuse the same source bytes/range; drop the visual + variable speed so it
      // is a clean, independent audio lane. The source clip is muted to avoid
      // doubling the sound.
      const audioClip: Clip = {
        ...src,
        id: uid(),
        trackId: track.id,
        audioOnly: true,
        muted: false,
        speedCurve: undefined,
        rect: { ...FULL_RECT },
        opacity: 1,
        flipH: false,
        flipV: false,
        rotation: 0,
      };
      const clips = state.clips.map((c) => (c.id === id ? { ...c, muted: true } : c));
      return { tracks: [...state.tracks, track], clips: [...clips, audioClip], ...selectOne(audioClip.id) };
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

  rippleDeleteClips: (ids) =>
    set((state) => {
      if (ids.length === 0) return {};
      const idset = new Set(ids);
      const deleted = state.clips.filter((c) => idset.has(c.id));
      if (deleted.length === 0) return {};
      const firstIdx = state.clips.findIndex((c) => idset.has(c.id));
      // Each survivor moves left by the total timeline length of deleted clips
      // that started at/before it on the same track, closing the gap they leave.
      const clips = state.clips
        .filter((c) => !idset.has(c.id))
        .map((c) => {
          let shift = 0;
          for (const d of deleted) {
            if (d.trackId === c.trackId && d.start <= c.start + 1e-6) shift += clipTimelineDuration(d);
          }
          return shift > 0 ? { ...c, start: Math.max(0, c.start - shift) } : c;
        });
      const next = clips[Math.min(firstIdx, clips.length - 1)]?.id ?? null;
      return { clips, ...selectOne(next) };
    }),

  setClipRect: (id, rect) => get().updateClip(id, { rect }),

  addKeyframeAtPlayhead: (id) => {
    const s = get();
    const clip = s.clips.find((c) => c.id === id);
    if (!clip || clip.text) return;
    const at = clamp(s.playback.currentTime - clip.start, 0, clipTimelineDuration(clip));
    const rect = clipTransformAt(clip, s.playback.currentTime).rect;
    get().updateClip(id, { keyframes: upsertKeyframeList(clip.keyframes, at, rect) });
  },

  upsertKeyframe: (id, at, rect) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || clip.text) return;
    const a = clamp(at, 0, clipTimelineDuration(clip));
    get().updateClip(id, { keyframes: upsertKeyframeList(clip.keyframes, a, rect) });
  },

  removeKeyframe: (id, index) => {
    const clip = get().clips.find((c) => c.id === id);
    if (!clip || !clip.keyframes) return;
    const next = clip.keyframes.filter((_, i) => i !== index);
    get().updateClip(id, { keyframes: next.length ? next : undefined });
  },

  clearKeyframes: (id) => get().updateClip(id, { keyframes: undefined }),

  setActiveClip: (id) => set(selectOne(id)),

  toggleSelect: (id) =>
    set((s) => {
      const has = s.selectedIds.includes(id);
      const selectedIds = has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id];
      const activeClipId = has ? selectedIds.at(-1) ?? null : id;
      return { selectedIds, activeClipId };
    }),

  selectClips: (ids) =>
    set((s) => {
      const present = ids.filter((id) => s.clips.some((c) => c.id === id));
      return { selectedIds: present, activeClipId: present.at(-1) ?? null };
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
  setBackground: (color) => set({ background: color }),
  setMuted: (m) => set({ muted: m }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setExportSettings: (s) => set((st) => ({ exportSettings: { ...st.exportSettings, ...s } })),

  setZoom: (z) => set({ zoom: clamp(z, ZOOM_MIN, ZOOM_MAX) }),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  toggleLoop: () => set((s) => ({ loop: !s.loop })),
  setTheme: (theme) => {
    saveTheme(theme);
    applyTheme(theme);
    set({ theme });
  },
  setAccent: (accent) => {
    saveAccent(accent);
    applyAccent(accent);
    set({ accent });
  },
  setReduceMotion: (on) => {
    saveReduceMotion(on);
    applyReduceMotion(on);
    set({ reduceMotion: on });
  },
  setCaptionDefaults: (patch) =>
    set((s) => {
      const captionDefaults = { ...s.captionDefaults, ...patch };
      writePref(CAPTION_DEFAULTS_KEY, captionDefaults);
      return { captionDefaults };
    }),
  setDefaultAspect: (aspect) => {
    writePref(DEFAULT_ASPECT_KEY, aspect);
    set({ defaultAspect: aspect });
  },
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
