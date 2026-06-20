import { useState } from 'react';
import { Download, Github, Redo2, Settings, Undo2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { UseProjects } from '@/hooks/useProjects';
import { REPO_URL } from '@/lib/constants';
import { BrandLogo } from '@/components/BrandLogo';
import { ProjectMenu } from '@/components/layout/ProjectMenu';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { Button } from '@/components/ui/Button';

export interface TopbarProps {
  projects: UseProjects;
  onExport?: () => void;
}

export function Topbar({ projects, onExport }: TopbarProps) {
  const hasContent = useEditorStore((s) => s.media.length > 0 || s.clips.length > 0);
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const showHistory = hasContent || canUndo || canRedo;
  const showProjects = hasContent || projects.items.length > 0;
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b border-line bg-surface/60 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:gap-3 lg:px-3">
      <BrandLogo className="pl-1" />

      <div className="mx-1 hidden h-6 w-px bg-line md:block" />

      {showProjects && <ProjectMenu projects={projects} />}

      {hasContent && (
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          spellCheck={false}
          className="hidden min-w-0 max-w-[44ch] flex-1 truncate rounded-lg bg-transparent px-2 py-1 text-sm text-ink-muted outline-none transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:text-ink sm:block"
          aria-label="Project name"
        />
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {showHistory && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (⌘/Ctrl+Z)"
              aria-label="Undo"
              className="grid h-9 w-9 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (⌘/Ctrl+Shift+Z)"
              aria-label="Redo"
              className="grid h-9 w-9 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
            >
              <Redo2 size={18} />
            </button>
          </div>
        )}
        <button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
          className="grid h-9 w-9 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Settings size={18} />
        </button>
        <Button variant="primary" size="md" disabled={!hasContent} onClick={onExport} title="Export video">
          <Download size={16} /> Export
        </Button>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          title="View source on GitHub"
          aria-label="View source on GitHub"
          className="grid h-9 w-9 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Github size={17} />
        </a>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
