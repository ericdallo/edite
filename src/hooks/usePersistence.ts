import { useEffect } from 'react';
import { DEFAULT_EXPORT_SETTINGS, type ExportSettings, type MediaItem, type MediaMeta } from '@/types/editor';
import { docsEqual, selectDoc, useEditorStore } from '@/store/editorStore';
import {
  getLastProjectId,
  getMedia,
  getSnapshot,
  saveSnapshot,
  setLastProjectId,
} from '@/lib/storage/projects';

let restored = false;

/** Restores the last project (media metadata + blobs) and auto-saves edits. */
export function usePersistence() {
  useEffect(() => {
    if (restored) return;
    restored = true;

    void (async () => {
      try {
        const id = getLastProjectId();
        if (!id || useEditorStore.getState().media.length > 0) return;
        const snap = await getSnapshot(id);
        if (!snap) return;

        const items: MediaItem[] = [];
        for (const meta of snap.media) {
          const blob = await getMedia(meta.id);
          if (blob) items.push({ ...meta, blob, url: URL.createObjectURL(blob) });
        }
        if (items.length === 0) return;

        useEditorStore.getState().hydrate({
          projectId: snap.id,
          projectName: snap.name,
          media: items,
          tracks: snap.tracks,
          clips: snap.clips,
          aspect: snap.aspect,
          muted: snap.muted,
          exportSettings: { ...DEFAULT_EXPORT_SETTINGS, ...snap.exportSettings },
          activeClipId: snap.clips[0]?.id ?? null,
          playback: { currentTime: 0, playing: false, volume: useEditorStore.getState().playback.volume },
        });
      } catch {
        // a failed restore should never block starting fresh
      }
    })();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastDoc = selectDoc(useEditorStore.getState());
    let lastExport: ExportSettings = useEditorStore.getState().exportSettings;

    const unsub = useEditorStore.subscribe((state) => {
      if (!state.projectId || state.media.length === 0) return;
      // Ignore playback-only ticks (currentTime advances ~60×/s while playing):
      // only re-arm the debounce when the persisted document actually changes.
      const doc = selectDoc(state);
      if (docsEqual(doc, lastDoc) && state.exportSettings === lastExport) return;
      lastDoc = doc;
      lastExport = state.exportSettings;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const s = useEditorStore.getState();
        if (!s.projectId || s.media.length === 0) return;
        void saveSnapshot({
          id: s.projectId,
          name: s.projectName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          media: s.media.map(
            (m): MediaMeta => ({
              id: m.id,
              kind: m.kind,
              fileName: m.fileName,
              mimeType: m.mimeType,
              size: m.size,
              duration: m.duration,
              width: m.width,
              height: m.height,
              hasAudio: m.hasAudio,
            }),
          ),
          tracks: s.tracks,
          clips: s.clips,
          aspect: s.aspect,
          muted: s.muted,
          exportSettings: s.exportSettings,
        });
        setLastProjectId(s.projectId);
      }, 700);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
