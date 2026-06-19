import { type ReactNode } from 'react';
import {
  Accessibility,
  Github,
  Globe,
  type LucideIcon,
  Magnet,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { REPO_URL, SITE_URL } from '@/lib/constants';
import { ACCENTS, type Theme } from '@/lib/theme';
import { ASPECT_RATIOS, type AspectRatioId } from '@/types/editor';
import { CAPTION_LANGUAGES, CAPTION_MODELS, type CaptionModelId } from '@/lib/captions/models';
import { CAPTION_LENGTH_OPTIONS, type CaptionLength } from '@/lib/captions/segments';
import { cn } from '@/lib/utils';

const selectClass =
  'w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand';

const THEME_OPTIONS: { id: Theme; label: string; icon: LucideIcon }[] = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'system', label: 'System', icon: Monitor },
];

function gpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { gpu?: unknown }).gpu != null;
}

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

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{children}</h3>;
}

export function GeneralSettings() {
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const accent = useEditorStore((s) => s.accent);
  const setAccent = useEditorStore((s) => s.setAccent);
  const reduceMotion = useEditorStore((s) => s.reduceMotion);
  const setReduceMotion = useEditorStore((s) => s.setReduceMotion);
  const snap = useEditorStore((s) => s.snap);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const defaultAspect = useEditorStore((s) => s.defaultAspect);
  const setDefaultAspect = useEditorStore((s) => s.setDefaultAspect);
  const captionDefaults = useEditorStore((s) => s.captionDefaults);
  const setCaptionDefaults = useEditorStore((s) => s.setCaptionDefaults);
  const hasGpu = gpuAvailable();

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <Heading>Appearance</Heading>
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

        <div>
          <div className="mb-2 text-xs font-medium text-ink-muted">Accent color</div>
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
        </div>

        <ToggleRow
          icon={<Accessibility size={17} />}
          label="Reduce motion"
          desc="Turn off the panel and dialog entrance animations."
          on={reduceMotion}
          onToggle={() => setReduceMotion(!reduceMotion)}
        />
      </section>

      <section className="space-y-3">
        <Heading>Editing</Heading>
        <ToggleRow
          icon={<Magnet size={17} />}
          label="Snap to edges"
          desc="Snap clips to neighbouring clips and the playhead while dragging."
          on={snap}
          onToggle={toggleSnap}
        />
        <div>
          <div className="mb-1.5 text-xs font-medium text-ink-muted">Default aspect ratio for new projects</div>
          <select
            value={defaultAspect}
            onChange={(e) => setDefaultAspect(e.target.value as AspectRatioId)}
            className={selectClass}
            aria-label="Default aspect ratio"
          >
            <option value="original">Original (match source)</option>
            {ASPECT_RATIOS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} — {a.hint}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-3">
        <Heading>Captions</Heading>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-muted">Default model</div>
            <select
              value={captionDefaults.model}
              onChange={(e) => setCaptionDefaults({ model: e.target.value as CaptionModelId })}
              className={selectClass}
              aria-label="Default caption model"
            >
              {CAPTION_MODELS.map((m) => (
                <option key={m.id} value={m.id} disabled={m.gpuOnly && !hasGpu}>
                  {m.label}
                  {m.gpuOnly && !hasGpu ? ' (needs GPU)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-muted">Default language</div>
            <select
              value={captionDefaults.language}
              onChange={(e) => setCaptionDefaults({ language: e.target.value })}
              className={selectClass}
              aria-label="Default caption language"
            >
              {CAPTION_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-ink-muted">Default length</div>
          <select
            value={captionDefaults.length}
            onChange={(e) => setCaptionDefaults({ length: e.target.value as CaptionLength })}
            className={selectClass}
            aria-label="Default caption length"
          >
            {CAPTION_LENGTH_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs leading-relaxed text-ink-faint">
          The starting point in the Auto-captions tool. Transcription always runs on your device.
        </p>
      </section>

      <section className="space-y-3">
        <Heading>About</Heading>
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
