import { Download, Plus, Redo2, Undo2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useProjects } from '@/hooks/useProjects';
import { BrandLogo } from '@/components/BrandLogo';
import { ProjectMenu } from '@/components/layout/ProjectMenu';
import { Button } from '@/components/ui/Button';
import { KeyboardHelp } from '@/components/KeyboardHelp';

export interface TopbarProps {
  onExport?: () => void;
}

export function Topbar({ onExport }: TopbarProps) {
  const hasMedia = useEditorStore((s) => s.media.length > 0);
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const showHistory = hasMedia || canUndo || canRedo;
  const projects = useProjects();
  const showProjects = hasMedia || projects.items.length > 0;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/60 px-3 backdrop-blur-md">
      <BrandLogo className="pl-1" />

      <div className="mx-2 hidden h-6 w-px bg-line md:block" />

      {showProjects && <ProjectMenu projects={projects} />}

      {hasMedia && (
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          spellCheck={false}
          className="min-w-0 max-w-[44ch] flex-1 truncate rounded-lg bg-transparent px-2 py-1 text-sm text-ink-muted outline-none transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:text-ink"
          aria-label="Project name"
        />
      )}

      <div className="ml-auto flex items-center gap-2">
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
        {hasMedia && <KeyboardHelp />}
        {hasMedia && (
          <Button variant="subtle" size="sm" onClick={() => void projects.create()}>
            <Plus size={16} /> New
          </Button>
        )}
        <Button variant="primary" size="md" disabled={!hasMedia} onClick={onExport}>
          <Download size={16} /> Export
        </Button>
      </div>
    </header>
  );
}
