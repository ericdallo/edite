import { type ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Plus, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { FONT_OPTIONS, type TextAlign } from '@/types/editor';
import { TEXT_SIZE_MAX, TEXT_SIZE_MIN } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';

const COLOR_SWATCHES = ['#ffffff', '#000000', '#8b5cf6', '#22d3ee', '#f43f5e', '#fbbf24', '#34d399'];

function Toggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors',
        active
          ? 'border-brand bg-brand/15 text-ink'
          : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Color ${color}`}
      className={cn(
        'h-7 w-7 rounded-full border transition-transform hover:scale-110',
        active ? 'border-white ring-2 ring-brand' : 'border-black/40',
      )}
      style={{ background: color }}
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-ink-muted">{label}</div>
      {children}
    </div>
  );
}

export function TextTool() {
  const activeId = useEditorStore((s) => s.activeClipId);
  const clips = useEditorStore((s) => s.clips);
  const updateText = useEditorStore((s) => s.updateText);
  const updateClips = useEditorStore((s) => s.updateClips);

  const clip = clips.find((c) => c.id === activeId && c.text);
  const text = clip?.text;

  const addText = () => {
    const s = useEditorStore.getState();
    if (!s.projectId) s.newProject({ name: 'Untitled project' });
    useEditorStore.getState().addTextClip();
  };

  return (
    <div className="space-y-5">
      <Button variant="secondary" size="sm" className="w-full" onClick={addText}>
        <Plus size={15} /> Add text
      </Button>

      {!text || !clip ? (
        <p className="text-sm leading-relaxed text-ink-faint">
          Add a text overlay, then select it to edit. Drag it on the preview to position it, and trim
          it on the timeline to set when it shows.
        </p>
      ) : (
        <>
          <textarea
            value={text.content}
            onChange={(e) => updateText(clip.id, { content: e.target.value })}
            rows={2}
            spellCheck={false}
            placeholder="Type your text…"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand/60"
          />

          <Field label="Font">
            <select
              value={text.fontFamily}
              onChange={(e) => updateText(clip.id, { fontFamily: e.target.value })}
              className="w-full rounded-lg border border-line bg-surface-2 px-2 py-2 text-sm text-ink outline-none transition-colors focus:border-brand/60"
              style={{ fontFamily: text.fontFamily }}
              aria-label="Font family"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.label} value={f.family} style={{ fontFamily: f.family }}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-ink-muted">Size</span>
              <span className="font-mono text-ink">{Math.round(text.fontSize * 1080)}px</span>
            </div>
            <Slider
              min={TEXT_SIZE_MIN}
              max={TEXT_SIZE_MAX}
              step={0.005}
              value={text.fontSize}
              onChange={(v) => updateText(clip.id, { fontSize: v })}
              ariaLabel="Font size"
            />
          </div>

          <Field label="Style">
            <div className="flex gap-2">
              <Toggle
                active={text.fontWeight >= 700}
                onClick={() => updateText(clip.id, { fontWeight: text.fontWeight >= 700 ? 400 : 700 })}
                label="Bold"
              >
                <Bold size={15} />
              </Toggle>
              <Toggle active={text.italic} onClick={() => updateText(clip.id, { italic: !text.italic })} label="Italic">
                <Italic size={15} />
              </Toggle>
              {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
                <Toggle
                  key={a}
                  active={text.align === a}
                  onClick={() => updateText(clip.id, { align: a })}
                  label={`Align ${a}`}
                >
                  {a === 'left' ? <AlignLeft size={15} /> : a === 'center' ? <AlignCenter size={15} /> : <AlignRight size={15} />}
                </Toggle>
              ))}
            </div>
          </Field>

          <Field label="Color">
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_SWATCHES.map((c) => (
                <Swatch key={c} color={c} active={text.color.toLowerCase() === c} onClick={() => updateText(clip.id, { color: c })} />
              ))}
              <label className="relative h-7 w-7 overflow-hidden rounded-full border border-line" title="Custom color">
                <span
                  className="block h-full w-full"
                  style={{ background: 'conic-gradient(from 180deg, #f43f5e, #fbbf24, #34d399, #22d3ee, #8b5cf6, #f43f5e)' }}
                />
                <input
                  type="color"
                  value={text.color}
                  onChange={(e) => updateText(clip.id, { color: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Custom text color"
                />
              </label>
            </div>
          </Field>

          <Field label="Background">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => updateText(clip.id, { background: null })}
                aria-label="No background"
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-full border text-[10px] font-semibold',
                  text.background === null
                    ? 'border-white text-ink ring-2 ring-brand'
                    : 'border-black/40 text-ink-faint',
                )}
                style={{ background: 'repeating-linear-gradient(45deg, #2c2c40 0 4px, transparent 4px 8px)' }}
              >
                ⃠
              </button>
              {COLOR_SWATCHES.map((c) => (
                <Swatch
                  key={c}
                  color={c}
                  active={text.background?.toLowerCase() === c}
                  onClick={() => updateText(clip.id, { background: c })}
                />
              ))}
            </div>
            {text.background !== null && (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-muted">Background opacity</span>
                  <span className="font-mono text-ink">{Math.round(text.backgroundOpacity * 100)}%</span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={text.backgroundOpacity}
                  onChange={(v) => updateText(clip.id, { backgroundOpacity: v })}
                  ariaLabel="Background opacity"
                />
              </div>
            )}
          </Field>

          <Toggle active={text.shadow} onClick={() => updateText(clip.id, { shadow: !text.shadow })} label="Shadow">
            <Sparkles size={15} /> Shadow
          </Toggle>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-ink-muted">Opacity</span>
              <span className="font-mono text-ink">{Math.round(clip.opacity * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={clip.opacity}
              onChange={(v) => updateClips([clip.id], { opacity: v })}
              ariaLabel="Text opacity"
            />
          </div>
        </>
      )}
    </div>
  );
}
