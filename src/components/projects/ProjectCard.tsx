import { useEffect, useRef, useState } from 'react';
import { Check, Clapperboard, Copy, Pencil, Trash2, X } from 'lucide-react';
import type { ProjectSummary } from '@/lib/storage/projects';
import { cn, formatRelativeTime } from '@/lib/utils';

export interface ProjectCardProps {
  project: ProjectSummary;
  active: boolean;
  busy: boolean;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function ProjectCard({
  project,
  active,
  busy,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: ProjectCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [confirming, setConfirming] = useState(false);
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

  return (
    <div
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border bg-surface-2 transition-colors',
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

        <p className="mt-0.5 truncate text-[11px] text-ink-faint">
          {project.clipCount} {project.clipCount === 1 ? 'clip' : 'clips'} · {project.mediaCount}{' '}
          {project.mediaCount === 1 ? 'media' : 'media'} · {formatRelativeTime(project.updatedAt)}
        </p>

        <div className="mt-2.5 flex items-center gap-1">
          {confirming ? (
            <>
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
            </>
          ) : (
            <>
              <button
                onClick={() => setRenaming(true)}
                disabled={busy}
                title="Rename"
                aria-label="Rename project"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={onDuplicate}
                disabled={busy}
                title="Duplicate"
                aria-label="Duplicate project"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50"
              >
                <Copy size={15} />
              </button>
              <button
                onClick={() => setConfirming(true)}
                disabled={busy}
                title="Delete"
                aria-label="Delete project"
                className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-danger/15 hover:text-danger disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
