import {
  DEFAULT_BACKGROUND,
  DEFAULT_EXPORT_SETTINGS,
  type MediaItem,
  type MediaMeta,
  type ProjectSnapshot,
} from '@/types/editor';
import { type EditorState, useEditorStore } from '@/store/editorStore';
import { getMedia, getSnapshot, saveSnapshot, setLastProjectId } from '@/lib/storage/projects';

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

/** Persist the active project (no-op when there's nothing to save). */
export async function saveCurrentProject(): Promise<void> {
  const s = useEditorStore.getState();
  if (!s.projectId || (s.media.length === 0 && s.clips.length === 0)) return;
  await saveSnapshot(snapshotFromState(s));
  setLastProjectId(s.projectId);
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
