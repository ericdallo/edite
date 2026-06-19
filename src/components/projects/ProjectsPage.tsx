import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FolderPlus, Plus, Search } from 'lucide-react';
import type { UseProjects } from '@/hooks/useProjects';
import { useEditorStore } from '@/store/editorStore';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/Button';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { cn, formatBytes } from '@/lib/utils';

type SortKey = 'recent' | 'name' | 'created';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'recent', label: 'Last edited' },
  { id: 'created', label: 'Date created' },
  { id: 'name', label: 'Name' },
];

export interface ProjectsPageProps {
  projects: UseProjects;
}

export function ProjectsPage({ projects }: ProjectsPageProps) {
  const { items, currentId, busy, switchTo, create, remove, duplicate, rename, refresh } = projects;
  const setView = useEditorStore((s) => s.setView);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [usedBytes, setUsedBytes] = useState<number | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Surface how much of the browser's storage the projects occupy.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const est = await navigator.storage?.estimate?.();
        if (alive && est) setUsedBytes(est.usage ?? 0);
      } catch {
        /* storage estimate is best-effort */
      }
    })();
    return () => {
      alive = false;
    };
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((p) => (p.name || 'untitled project').toLowerCase().includes(q))
      : items;
    const sorted = [...filtered];
    if (sort === 'name') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sort === 'created') sorted.sort((a, b) => b.createdAt - a.createdAt);
    else sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted;
  }, [items, query, sort]);

  const open = async (id: string) => {
    if (id !== currentId) await switchTo(id);
    setView('editor');
  };

  const onNew = async () => {
    await create();
    setView('editor');
  };

  return (
    <div className="edite-fade flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/60 px-2 backdrop-blur-md lg:gap-3 lg:px-3">
        <button
          onClick={() => setView('editor')}
          title="Back to editor"
          aria-label="Back to editor"
          className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ArrowLeft size={18} />
          <span className="hidden text-sm sm:block">Editor</span>
        </button>
        <div className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <BrandLogo className="hidden sm:flex" />
        <h1 className="text-sm font-semibold text-ink sm:hidden">Projects</h1>

        <div className="ml-auto flex items-center gap-2">
          {usedBytes !== null && (
            <span className="hidden text-xs text-ink-faint md:block">
              {formatBytes(usedBytes)} used on this device
            </span>
          )}
          <Button variant="primary" size="md" onClick={onNew} disabled={busy} title="New project">
            <Plus size={16} /> New project
          </Button>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <h2 className="mr-1 hidden text-base font-semibold text-ink sm:block">
          Projects <span className="text-ink-faint">({items.length})</span>
        </h2>
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects"
            spellCheck={false}
            className="w-full rounded-lg border border-line bg-surface-2 py-1.5 pl-8 pr-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand/60"
            aria-label="Search projects"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort projects"
          className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-brand/60"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {visible.length === 0 ? (
          <div className="mx-auto mt-16 flex max-w-sm flex-col items-center text-center">
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-ink-faint">
              <FolderPlus size={26} />
            </span>
            <p className="text-sm font-medium text-ink">
              {items.length === 0 ? 'No projects yet' : 'No projects match your search'}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {items.length === 0
                ? 'Everything stays on this device. Create a project to get started.'
                : 'Try a different name.'}
            </p>
            {items.length === 0 && (
              <Button variant="primary" size="md" onClick={onNew} disabled={busy} className="mt-5">
                <Plus size={16} /> New project
              </Button>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'mx-auto grid max-w-6xl gap-4',
              'grid-cols-[repeat(auto-fill,minmax(200px,1fr))]',
            )}
          >
            {visible.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                active={p.id === currentId}
                busy={busy}
                onOpen={() => void open(p.id)}
                onRename={(name) => void rename(p.id, name)}
                onDuplicate={() => void duplicate(p.id)}
                onDelete={() => void remove(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
