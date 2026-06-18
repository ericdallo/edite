import { useEffect } from 'react';
import type { ExportSettings } from '@/types/editor';
import { docsEqual, selectDoc, useEditorStore } from '@/store/editorStore';
import { getLastProjectId } from '@/lib/storage/projects';
import { openProject, saveCurrentProject } from '@/lib/storage/session';

let restored = false;

/** Restores the last project on load and auto-saves edits to the browser. */
export function usePersistence() {
  useEffect(() => {
    if (restored) return;
    restored = true;

    void (async () => {
      try {
        const id = getLastProjectId();
        if (!id || useEditorStore.getState().media.length > 0) return;
        await openProject(id);
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
      if (!state.projectId || (state.media.length === 0 && state.clips.length === 0)) return;
      // Ignore playback-only ticks (currentTime advances ~60×/s while playing):
      // only re-arm the debounce when the persisted document actually changes.
      const doc = selectDoc(state);
      if (docsEqual(doc, lastDoc) && state.exportSettings === lastExport) return;
      lastDoc = doc;
      lastExport = state.exportSettings;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void saveCurrentProject(), 700);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
