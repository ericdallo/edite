import { useCallback, useState } from 'react';
import type { MediaItem } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { probeMedia } from '@/lib/media/probe';
import { saveMedia } from '@/lib/storage/projects';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface UseImportMedia {
  importFiles: (files: FileList | File[], opts?: { addToTimeline?: boolean }) => Promise<void>;
  busy: boolean;
  error: string | null;
}

/** Probe + register uploaded media (video or image) and persist the bytes. */
export function useImportMedia(): UseImportMedia {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFiles = useCallback<UseImportMedia['importFiles']>(async (files, opts) => {
    const arr = Array.from(files).filter(
      (f) => f.type.startsWith('video/') || f.type.startsWith('image/'),
    );
    if (arr.length === 0) {
      setError('Please choose a video or image file.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const store = useEditorStore.getState();
      if (!store.projectId) {
        store.newProject({ name: arr[0].name.replace(/\.[^/.]+$/, '') || 'Untitled project' });
      }
      for (const file of arr) {
        const probed = await probeMedia(file);
        const id = uid();
        const url = URL.createObjectURL(file);
        const item: MediaItem = { id, url, blob: file, ...probed };
        useEditorStore.getState().addMedia(item);
        if (opts?.addToTimeline !== false) useEditorStore.getState().addClipFromMedia(id);
        void saveMedia(id, file);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that file.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { importFiles, busy, error };
}
