import { Download, Plus } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { Button } from '@/components/ui/Button';
import { KeyboardHelp } from '@/components/KeyboardHelp';

export interface TopbarProps {
  onExport?: () => void;
  onNew?: () => void;
}

export function Topbar({ onExport, onNew }: TopbarProps) {
  const hasMedia = useEditorStore((s) => s.media.length > 0);
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/60 px-3 backdrop-blur-md">
      <div className="flex items-center gap-2.5 pl-1">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-bright to-accent shadow-lg shadow-brand/30">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M8 6l10 6-10 6V6z" fill="white" />
          </svg>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">edite</span>
          <span className="hidden rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-muted sm:inline">
            free
          </span>
        </div>
      </div>

      <div className="mx-2 hidden h-6 w-px bg-line md:block" />

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
        {hasMedia && <KeyboardHelp />}
        {hasMedia && (
          <Button variant="subtle" size="sm" onClick={onNew}>
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
