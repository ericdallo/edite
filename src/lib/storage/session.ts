import {
  DEFAULT_BACKGROUND,
  DEFAULT_EXPORT_SETTINGS,
  type MediaItem,
  type MediaMeta,
  type ProjectSnapshot,
} from '@/types/editor';
import { type EditorState, useEditorStore } from '@/store/editorStore';
import {
  getMedia,
  getSnapshot,
  saveSnapshot,
  setLastProjectId,
  setProjectThumbnail,
} from '@/lib/storage/projects';
import { generatePoster, posterSourceFor } from '@/lib/media/poster';

/** The slice of store state that maps onto a persisted snapshot. */
type PersistableState = Pick<
  EditorState,
  | 'projectId'
  | 'projectName'
  | 'media'
  | 'tracks'
  | 'clips'
  | 'aspect'
  | 'background'
  | 'muted'
  | 'exportSettings'
>;

/** Strip runtime-only fields (url, blob) from media for persistence. */
export function mediaMetaFromItems(media: MediaItem[]): MediaMeta[] {
  return media.map((m) => ({
    id: m.id,
    kind: m.kind,
    fileName: m.fileName,
    mimeType: m.mimeType,
    size: m.size,
    duration: m.duration,
    width: m.width,
    height: m.height,
    hasAudio: m.hasAudio,
  }));
}

/** Build a persistable snapshot from the current document state. */
export function snapshotFromState(s: PersistableState): ProjectSnapshot {
  const now = Date.now();
  return {
    id: s.projectId,
    name: s.projectName,
    createdAt: now,
    updatedAt: now,
    media: mediaMetaFromItems(s.media),
    tracks: s.tracks,
    clips: s.clips,
    aspect: s.aspect,
    background: s.background,
    muted: s.muted,
    exportSettings: s.exportSettings,
  };
}

// Last poster `mediaId@time` rendered per project, so we only re-decode a frame
// when the representative clip actually changes.
const posterKeys = new Map<string, string>();
const posterInFlight = new Set<string>();

/** Best-effort: refresh the project's list poster without blocking the save. */
async function refreshPoster(s: PersistableState): Promise<void> {
  const source = posterSourceFor(s.clips, s.tracks, s.media);
  if (!source) return;
  const key = `${source.mediaId}@${source.time.toFixed(3)}`;
  if (posterKeys.get(s.projectId) === key || posterInFlight.has(s.projectId)) return;
  const media = s.media.find((m) => m.id === source.mediaId);
  if (!media) return;
  posterInFlight.add(s.projectId);
  try {
    const poster = await generatePoster(media, source.time);
    if (poster) {
      await setProjectThumbnail(s.projectId, poster);
      posterKeys.set(s.projectId, key);
    }
  } catch {
    // a missing poster is never worth failing a save over
  } finally {
    posterInFlight.delete(s.projectId);
  }
}

/** Persist the active project (no-op when there's nothing to save). */
export async function saveCurrentProject(): Promise<void> {
  const s = useEditorStore.getState();
  if (!s.projectId || (s.media.length === 0 && s.clips.length === 0)) return;
  await saveSnapshot(snapshotFromState(s));
  setLastProjectId(s.projectId);
  void refreshPoster(s);
}

/** Load a stored project into the store, revoking the previous project's object URLs. */
export async function openProject(id: string): Promise<boolean> {
  const data = await getSnapshot(id);
  if (!data) return false;

  const items: MediaItem[] = [];
  for (const meta of data.media) {
    const blob = await getMedia(meta.id);
    if (blob) items.push({ ...meta, blob, url: URL.createObjectURL(blob) });
  }

  const prev = useEditorStore.getState().media;
  const volume = useEditorStore.getState().playback.volume;
  useEditorStore.getState().hydrate({
    projectId: data.id,
    projectName: data.name,
    media: items,
    tracks: data.tracks,
    clips: data.clips,
    aspect: data.aspect,
    background: data.background ?? DEFAULT_BACKGROUND,
    muted: data.muted,
    exportSettings: { ...DEFAULT_EXPORT_SETTINGS, ...data.exportSettings },
    activeClipId: data.clips[0]?.id ?? null,
    selectedIds: data.clips[0] ? [data.clips[0].id] : [],
    clipboard: [],
    zoom: 1,
    snap: true,
    selectedTool: 'media',
    isExporting: false,
    exportProgress: 0,
    exportStage: '',
    playback: { currentTime: 0, playing: false, volume },
  });
  for (const m of prev) URL.revokeObjectURL(m.url);
  setLastProjectId(id);
  return true;
}
