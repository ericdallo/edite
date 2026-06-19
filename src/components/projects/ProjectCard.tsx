import { useEffect, useRef, useState } from 'react';
import { Check, Clapperboard, Copy, Download, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import type { ProjectSummary } from '@/lib/storage/projects';
import { ContextMenu, type ContextMenuState } from '@/components/ui/ContextMenu';
import { cn, formatRelativeTime } from '@/lib/utils';

export interface ProjectCardProps {
  project: ProjectSummary;
  active: boolean;
  busy: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export function ProjectCard({
  project,
  active,
  busy,
  onOpen,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
}: ProjectCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [confirming, setConfirming] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) return;
    setDraft(project.name || '');
    const el = inputRef.current;
    el?.focus();
    el?.select();
  }, [renaming, project.name]);

  const commit = () => {
    const name = draft.trim();
    setRenaming(false);
    if (name && name !== project.name) onRename(name);
  };

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({
      x: r.right - 204,
      y: r.bottom + 4,
      items: [
        { id: 'rename', label: 'Rename', icon: <Pencil size={15} />, onClick: () => setRenaming(true) },
        { id: 'duplicate', label: 'Duplicate', icon: <Copy size={15} />, onClick: onDuplicate },
        { id: 'export', label: 'Export .edite', icon: <Download size={15} />, onClick: onExport },
        {
          id: 'delete',
          label: 'Delete',
          icon: <Trash2 size={15} />,
          danger: true,
          separatorBefore: true,
          onClick: () => setConfirming(true),
        },
      ],
    });
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-surface-2 transition-colors',
        active ? 'border-brand/60' : 'border-line',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        title="Open project"
        className="relative block aspect-video w-full overflow-hidden bg-surface-3 disabled:opacity-60"
      >
        {project.thumbnail ? (
          <img src={project.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/20 to-accent/15 text-ink-faint">
            <Clapperboard size={26} />
          </span>
        )}
        {active && (
          <span className="absolute left-2 top-2 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
            Active
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={openMenu}
        disabled={busy}
        title="Project actions"
        aria-label="Project actions"
        className={cn(
          'absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg bg-canvas/60 text-ink backdrop-blur-sm transition-opacity hover:bg-canvas/80 disabled:opacity-40',
          'opacity-100 lg:opacity-0 lg:group-hover:opacity-100',
          menu && 'lg:opacity-100',
        )}
      >
        <MoreVertical size={16} />
      </button>

      <div className="flex min-w-0 flex-1 flex-col p-3">
        {renaming ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              else if (e.key === 'Escape') setRenaming(false);
            }}
            spellCheck={false}
            className="w-full rounded-lg bg-surface-3 px-2 py-1 text-sm text-ink outline-none ring-1 ring-brand/60"
            aria-label="Project name"
          />
        ) : (
          <button
            type="button"
            onClick={onOpen}
            title={project.name || 'Untitled project'}
            className="truncate text-left text-sm font-medium text-ink hover:text-brand-bright"
          >
            {project.name || 'Untitled project'}
          </button>
        )}

        {confirming ? (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="mr-auto text-[11px] text-ink-muted">Delete this project?</span>
            <button
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
              disabled={busy}
              title="Confirm delete"
              aria-label="Confirm delete"
              className="grid h-8 w-8 place-items-center rounded-lg text-danger transition-colors hover:bg-danger/15 disabled:opacity-50"
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => setConfirming(false)}
              title="Cancel"
              aria-label="Cancel delete"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <p className="mt-0.5 truncate text-[11px] text-ink-faint">
            {project.clipCount} {project.clipCount === 1 ? 'clip' : 'clips'} · {project.mediaCount} media ·{' '}
            {formatRelativeTime(project.updatedAt)}
          </p>
        )}
      </div>

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
