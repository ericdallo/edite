import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import {
  getLastProjectId,
  getMedia,
  getSnapshot,
  saveSnapshot,
  setLastProjectId,
} from '@/lib/storage/projects';

// Guard against React StrictMode double-invocation re-restoring the project.
let restored = false;

/** Restores the last project from IndexedDB on load and auto-saves edits. */
export function usePersistence() {
  useEffect(() => {
    if (restored) return;
    restored = true;

    void (async () => {
      try {
        const id = getLastProjectId();
        if (!id || useEditorStore.getState().source) return;
        const [snap, blob] = await Promise.all([getSnapshot(id), getMedia(id)]);
        if (!snap || !blob) return;

        const url = URL.createObjectURL(blob);
        const store = useEditorStore.getState();
        store.loadSource({ meta: snap.source, url, blob, name: snap.name, id: snap.id });
        store.hydrate({
          projectName: snap.name,
          segments: snap.segments.length ? snap.segments : useEditorStore.getState().segments,
          activeSegmentId: snap.segments[0]?.id ?? useEditorStore.getState().activeSegmentId,
          speed: snap.speed,
          muted: snap.muted,
          crop: snap.crop,
          aspect: snap.aspect,
          aspectMode: snap.aspectMode,
          exportSettings: snap.exportSettings,
        });
      } catch {
        // A failed restore should never block starting fresh.
      }
    })();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useEditorStore.subscribe((state) => {
      if (!state.source || !state.projectId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const s = useEditorStore.getState();
        if (!s.source) return;
        void saveSnapshot({
          id: s.projectId,
          name: s.projectName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: s.source,
          segments: s.segments,
          speed: s.speed,
          muted: s.muted,
          crop: s.crop,
          aspect: s.aspect,
          aspectMode: s.aspectMode,
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
