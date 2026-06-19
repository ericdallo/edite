import { useCallback, useEffect, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import {
  clearLastProjectId,
  deleteProject,
  duplicateProject,
  listProjects,
  renameProject,
  type ProjectSummary,
} from '@/lib/storage/projects';
import { openProject, saveCurrentProject } from '@/lib/storage/session';

export interface UseProjects {
  items: ProjectSummary[];
  currentId: string;
  busy: boolean;
  refresh: () => Promise<void>;
  switchTo: (id: string) => Promise<void>;
  create: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
}

/** Lists browser-stored projects and switches/creates/deletes the active one. */
export function useProjects(): UseProjects {
  const [items, setItems] = useState<ProjectSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const currentId = useEditorStore((s) => s.projectId);

  const refresh = useCallback(async () => {
    setItems(await listProjects());
  }, []);

  // Refresh on mount and whenever the active project changes (open / new / delete).
  useEffect(() => {
    void refresh();
  }, [refresh, currentId]);

  const switchTo = useCallback(
    async (id: string) => {
      if (id === useEditorStore.getState().projectId) return;
      setBusy(true);
      try {
        await saveCurrentProject();
        await openProject(id);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const create = useCallback(async () => {
    setBusy(true);
    try {
      await saveCurrentProject();
      useEditorStore.getState().closeProject();
      clearLastProjectId();
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await deleteProject(id);
        if (id === useEditorStore.getState().projectId) {
          useEditorStore.getState().closeProject();
          clearLastProjectId();
        }
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const duplicate = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        // Capture the latest edits first so duplicating the active project copies them.
        if (id === useEditorStore.getState().projectId) await saveCurrentProject();
        await duplicateProject(id);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      setBusy(true);
      try {
        if (id === useEditorStore.getState().projectId) {
          useEditorStore.getState().setProjectName(name);
          await saveCurrentProject();
        } else {
          await renameProject(id, name);
        }
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  return { items, currentId, busy, refresh, switchTo, create, remove, duplicate, rename };
}
