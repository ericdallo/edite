import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { FONT_OPTIONS } from '@/types/editor';
import { cn } from '@/lib/utils';

/** Human label for a font-family stack, falling back to its first family name. */
export function fontLabel(family: string): string {
  const hit = FONT_OPTIONS.find((f) => f.family === family);
  if (hit) return hit.label;
  return family.split(',')[0].trim().replace(/^["']|["']$/g, '') || 'Font';
}

/**
 * Scrollable list of fonts, each row previewed in its own face. Clicking a row
 * calls `onPick` with the CSS font-family stack (stored verbatim on the clip).
 */
export function FontList({ value, onPick }: { value?: string; onPick: (family: string) => void }) {
  return (
    <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-xl border border-line bg-surface-2 p-1.5">
      {FONT_OPTIONS.map((f) => {
        const active = value === f.family;
        return (
          <button
            key={f.label}
            onClick={() => onPick(f.family)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors',
              active ? 'bg-brand/15 text-brand-bright' : 'text-ink hover:bg-surface-3',
            )}
            style={{ fontFamily: f.family }}
          >
            <span className="truncate text-base leading-none">{f.label}</span>
            {active && <Check size={15} className="shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

/** A compact popover trigger showing the current font, opening {@link FontList}. */
export function FontField({ value, onPick }: { value: string; onPick: (family: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/60"
        style={{ fontFamily: value }}
      >
        <span className="truncate">{fontLabel(value)}</span>
        <ChevronDown size={15} className="shrink-0 text-ink-muted" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1">
          <FontList
            value={value}
            onPick={(f) => {
              onPick(f);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
