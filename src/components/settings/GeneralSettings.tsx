import { type ReactNode } from 'react';
import { Github, Globe, Magnet } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { REPO_URL, SITE_URL } from '@/lib/constants';
import { cn } from '@/lib/utils';

function ToggleRow({
  icon,
  label,
  desc,
  on,
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-left transition-colors hover:bg-surface-3"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-muted">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs leading-relaxed text-ink-faint">{desc}</span>
      </span>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-brand' : 'bg-surface-3')}>
        <span
          className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', on ? 'left-[22px]' : 'left-0.5')}
        />
      </span>
    </button>
  );
}

export function GeneralSettings() {
  const snap = useEditorStore((s) => s.snap);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Editing</h3>
        <ToggleRow
          icon={<Magnet size={17} />}
          label="Snap to edges"
          desc="Snap clips to neighbouring clips and the playhead while dragging."
          on={snap}
          onToggle={toggleSnap}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">About</h3>
        <p className="text-sm leading-relaxed text-ink-muted">
          edite is a free, 100% in-browser video editor. Your media never leaves your device — everything
          runs locally and is stored in your browser.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={SITE_URL}
            title="Open edite.video"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Globe size={15} /> Website
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            title="View source on GitHub"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Github size={15} /> GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
