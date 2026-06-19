import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared styling for the <select> controls across settings panels. */
export const selectClass =
  'w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand';

/** A labelled control group. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-ink-muted">{label}</div>
      {children}
    </div>
  );
}

/** A row with an icon, label/description and a switch. */
export function ToggleRow({
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
