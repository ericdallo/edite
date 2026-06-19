import { Accessibility, type LucideIcon, Monitor, Moon, Sun } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { ACCENTS, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Field, ToggleRow } from './controls';

const THEME_OPTIONS: { id: Theme; label: string; icon: LucideIcon }[] = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'system', label: 'System', icon: Monitor },
];

export function AppearanceSettings() {
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const accent = useEditorStore((s) => s.accent);
  const setAccent = useEditorStore((s) => s.setAccent);
  const reduceMotion = useEditorStore((s) => s.reduceMotion);
  const setReduceMotion = useEditorStore((s) => s.setReduceMotion);

  return (
    <div className="space-y-6">
      <Field label="Theme">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = theme === o.id;
            return (
              <button
                key={o.id}
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(o.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-brand bg-brand/15 text-ink'
                    : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
                )}
              >
                <Icon size={18} />
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          "System" follows your operating system's appearance.
        </p>
      </Field>

      <Field label="Accent color">
        <div className="flex flex-wrap items-center gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccent(a.id)}
              aria-label={a.label}
              aria-pressed={accent === a.id}
              title={a.label}
              className={cn(
                'h-7 w-7 rounded-full border transition-transform hover:scale-110',
                accent === a.id ? 'border-white ring-2 ring-brand' : 'border-black/40',
              )}
              style={{ background: a.swatch }}
            />
          ))}
        </div>
      </Field>

      <ToggleRow
        icon={<Accessibility size={17} />}
        label="Reduce motion"
        desc="Turn off the panel and dialog entrance animations."
        on={reduceMotion}
        onToggle={() => setReduceMotion(!reduceMotion)}
      />
    </div>
  );
}
