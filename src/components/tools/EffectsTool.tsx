import { Sparkles } from 'lucide-react';
import { COLOR_PRESETS, type ColorAdjust, NEUTRAL_COLOR } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { colorEquals, isNeutralColor } from '@/lib/color';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/Slider';

function Adjust({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-ink-muted">{label}</span>
        <span className="font-mono text-ink">{fmt(value)}</span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

export function EffectsTool() {
  const activeId = useEditorStore((s) => s.activeClipId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const clips = useEditorStore((s) => s.clips);
  const updateClips = useEditorStore((s) => s.updateClips);
  const clip = clips.find((c) => c.id === activeId);

  if (!clip) {
    return <p className="text-sm text-ink-faint">Select a clip on the timeline to color grade it.</p>;
  }

  if (clip.text || clip.audioOnly) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-ink">
          <Sparkles className="h-4 w-4 text-brand" />
          <span className="font-medium">Effects</span>
        </div>
        <p className="text-xs leading-relaxed text-ink-faint">
          Color filters apply to video and image clips. Select one to get started.
        </p>
      </div>
    );
  }

  const color: ColorAdjust = clip.color ?? NEUTRAL_COLOR;
  const count = selectedIds.length;
  const neutral = isNeutralColor(clip.color);
  const set = (patch: Partial<ColorAdjust>) => updateClips(selectedIds, { color: { ...color, ...patch } });

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-sm text-ink-muted">Filters</div>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_PRESETS.map((p) => {
            const on = p.id === 'none' ? neutral : colorEquals(clip.color, p.color);
            return (
              <button
                key={p.id}
                onClick={() =>
                  updateClips(selectedIds, { color: p.id === 'none' ? undefined : { ...p.color } })
                }
                className={cn(
                  'rounded-xl border px-2 py-2 text-xs font-medium transition-colors',
                  on
                    ? 'border-brand bg-brand/10 text-ink'
                    : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 border-t border-line pt-4">
        <Adjust
          label="Brightness"
          value={color.brightness}
          min={0.5}
          max={1.5}
          step={0.01}
          onChange={(v) => set({ brightness: v })}
          fmt={(v) => `${Math.round(v * 100)}%`}
        />
        <Adjust
          label="Contrast"
          value={color.contrast}
          min={0.5}
          max={1.5}
          step={0.01}
          onChange={(v) => set({ contrast: v })}
          fmt={(v) => `${Math.round(v * 100)}%`}
        />
        <Adjust
          label="Saturation"
          value={color.saturation}
          min={0}
          max={2}
          step={0.01}
          onChange={(v) => set({ saturation: v })}
          fmt={(v) => `${Math.round(v * 100)}%`}
        />
        <Adjust
          label="Hue"
          value={color.hue}
          min={-180}
          max={180}
          step={1}
          onChange={(v) => set({ hue: v })}
          fmt={(v) => `${Math.round(v)}\u00b0`}
        />
      </div>

      {!neutral && (
        <button
          onClick={() => updateClips(selectedIds, { color: undefined })}
          className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
        >
          Reset color
        </button>
      )}

      <p className="text-xs leading-relaxed text-ink-faint">
        {count > 1
          ? `Color applies to all ${count} selected clips.`
          : 'The preview uses CSS filters; the export renders the same look with ffmpeg.'}
      </p>
    </div>
  );
}
