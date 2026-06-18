import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, FolderOpen, Plus, Trash2, X } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import type { ProjectSummary } from '@/lib/storage/projects';
import type { UseProjects } from '@/hooks/useProjects';
import { cn, formatRelativeTime } from '@/lib/utils';

const PANEL_WIDTH = 288;

export interface ProjectMenuProps {
  projects: UseProjects;
}

export function ProjectMenu({ projects }: ProjectMenuProps) {
  const { items, currentId, busy, switchTo, create, remove, refresh } = projects;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const projectName = useEditorStore((s) => s.projectName);
  const clipCount = useEditorStore((s) => s.clips.length);
  const mediaCount = useEditorStore((s) => s.media.length);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_WIDTH - 8));
    setPos({ left, top: r.bottom + 6 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, refresh]);

  useEffect(() => {
    if (!open) setConfirmId(null);
  }, [open]);

  // Reflect live edits to the active project and surface it even before its first save.
  const rows: ProjectSummary[] = items.map((p) =>
    p.id === currentId ? { ...p, name: projectName, clipCount, mediaCount } : p,
  );
  if (currentId && mediaCount > 0 && !items.some((p) => p.id === currentId)) {
    const now = Date.now();
    rows.unshift({ id: currentId, name: projectName, createdAt: now, updatedAt: now, clipCount, mediaCount });
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        title="Projects"
        aria-label="Projects"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'grid h-9 grid-flow-col items-center gap-0.5 rounded-xl px-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink',
          open && 'bg-surface-2 text-ink',
        )}
      >
        <FolderOpen size={17} />
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ left: pos.left, top: pos.top, width: PANEL_WIDTH }}
            className="edite-pop fixed z-[60] overflow-hidden rounded-xl border border-line bg-surface-2 shadow-2xl"
            role="menu"
          >
            <button
              onClick={async () => {
                setOpen(false);
                await create();
              }}
              disabled={busy}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-3 disabled:opacity-50"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/15 text-brand-bright">
                <Plus size={16} />
              </span>
              New project
            </button>

            <div className="h-px bg-line" />

            {rows.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-ink-faint">No saved projects yet.</p>
            ) : (
              <ul className="max-h-[min(60vh,22rem)] overflow-y-auto py-1">
                {rows.map((p) => {
                  const active = p.id === currentId;
                  const confirming = confirmId === p.id;
                  return (
                    <li key={p.id} className="px-1">
                      <div
                        className={cn(
                          'group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                          active ? 'bg-brand/10' : 'hover:bg-surface-3',
                        )}
                      >
                        <button
                          onClick={async () => {
                            if (active) {
                              setOpen(false);
                              return;
                            }
                            setOpen(false);
                            await switchTo(p.id);
                          }}
                          disabled={busy}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-50"
                          role="menuitem"
                        >
                          <span
                            className={cn(
                              'grid h-4 w-4 shrink-0 place-items-center',
                              active ? 'text-brand-bright' : 'text-transparent',
                            )}
                          >
                            <Check size={14} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block truncate text-sm',
                                active ? 'font-medium text-ink' : 'text-ink',
                              )}
                            >
                              {p.name || 'Untitled project'}
                            </span>
                            <span className="block truncate text-[11px] text-ink-faint">
                              {p.clipCount} {p.clipCount === 1 ? 'clip' : 'clips'} · {formatRelativeTime(p.updatedAt)}
                            </span>
                          </span>
                        </button>

                        {confirming ? (
                          <span className="flex shrink-0 items-center gap-0.5">
                            <button
                              onClick={async () => {
                                setConfirmId(null);
                                await remove(p.id);
                              }}
                              disabled={busy}
                              title="Confirm delete"
                              aria-label="Confirm delete"
                              className="grid h-7 w-7 place-items-center rounded-lg text-danger transition-colors hover:bg-danger/15 disabled:opacity-50"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              title="Cancel"
                              aria-label="Cancel delete"
                              className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                            >
                              <X size={15} />
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmId(p.id)}
                            disabled={busy}
                            title="Delete project"
                            aria-label={`Delete ${p.name || 'project'}`}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-faint opacity-100 transition-colors hover:bg-danger/15 hover:text-danger focus-visible:opacity-100 disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
