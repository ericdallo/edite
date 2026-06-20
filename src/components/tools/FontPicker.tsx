import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Trash2, Upload } from 'lucide-react';
import { FONT_OPTIONS } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { createCustomFont } from '@/lib/fonts';
import { cn } from '@/lib/utils';

/** Human label for a font-family stack, falling back to its first family name. */
export function fontLabel(family: string): string {
  const hit = FONT_OPTIONS.find((f) => f.family === family);
  if (hit) return hit.label;
  return family.split(',')[0].trim().replace(/^["']|["']$/g, '') || 'Font';
}

function Row({
  label,
  family,
  active,
  onPick,
  onRemove,
}: {
  label: string;
  family: string;
  active: boolean;
  onPick: (family: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="group flex items-center">
      <button
        onClick={() => onPick(family)}
        className={cn(
          'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors',
          active ? 'bg-brand/15 text-brand-bright' : 'text-ink hover:bg-surface-3',
        )}
        style={{ fontFamily: family }}
      >
        <span className="truncate text-base leading-none">{label}</span>
        {active && <Check size={15} className="shrink-0" />}
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          title="Remove font"
          className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-faint opacity-0 transition-colors hover:bg-danger/15 hover:text-danger group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * Scrollable list of fonts, each row previewed in its own face, plus the
 * project's imported fonts and an "Import font" control. Clicking a row calls
 * `onPick` with the CSS font-family stack (stored verbatim on the clip).
 */
export function FontList({ value, onPick }: { value?: string; onPick: (family: string) => void }) {
  const customFonts = useEditorStore((s) => s.customFonts);
  const addCustomFont = useEditorStore((s) => s.addCustomFont);
  const removeFont = useEditorStore((s) => s.removeFont);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const font = await createCustomFont(file);
      addCustomFont(font);
      onPick(font.family);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that font.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-xl border border-line bg-surface-2 p-1.5">
      {FONT_OPTIONS.map((f) => (
        <Row key={f.label} label={f.label} family={f.family} active={value === f.family} onPick={onPick} />
      ))}

      {customFonts.length > 0 && (
        <div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          Imported
        </div>
      )}
      {customFonts.map((f) => (
        <Row
          key={f.id}
          label={f.label}
          family={f.family}
          active={value === f.family}
          onPick={onPick}
          onRemove={() => removeFont(f.id)}
        />
      ))}

      <div className="pt-1">
        <input
          ref={inputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,.ttc"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-ink-muted transition-colors hover:border-brand/60 hover:text-ink disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import font
        </button>
        {error && <p className="px-1 pt-1.5 text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}

/** A compact popover trigger showing the current font, opening {@link FontList}. */
export function FontField({ value, onPick }: { value: string; onPick: (family: string) => void }) {
  const customFonts = useEditorStore((s) => s.customFonts);
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

  const label = customFonts.find((f) => f.family === value)?.label ?? fontLabel(value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-brand/60"
        style={{ fontFamily: value }}
      >
        <span className="truncate">{label}</span>
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
