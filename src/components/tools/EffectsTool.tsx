import { Sparkles } from 'lucide-react';
import {
  CHROMA_SWATCHES,
  COLOR_PRESETS,
  type ChromaKey,
  type ColorAdjust,
  DEFAULT_CHROMA,
  NEUTRAL_COLOR,
  TRANSITIONS,
} from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { colorEquals, isNeutralColor } from '@/lib/color';
import { canAddTransition, maxTransitionDuration } from '@/lib/timeline';
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

export function EffectsTool({ sub = 'filters' }: { sub?: string }) {
  const activeId = useEditorStore((s) => s.activeClipId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const clips = useEditorStore((s) => s.clips);
  const media = useEditorStore((s) => s.media);
  const updateClips = useEditorStore((s) => s.updateClips);
  const setClipTransition = useEditorStore((s) => s.setClipTransition);
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
          Effects apply to video and image clips. Select one to get started.
        </p>
      </div>
    );
  }

  const color: ColorAdjust = clip.color ?? NEUTRAL_COLOR;
  const count = selectedIds.length;
  const neutral = isNeutralColor(clip.color);
  const set = (patch: Partial<ColorAdjust>) => updateClips(selectedIds, { color: { ...color, ...patch } });

  const isVideo = media.find((m) => m.id === clip.mediaId)?.kind === 'video';
  const chroma: ChromaKey = clip.chromaKey ?? DEFAULT_CHROMA;
  const keyOn = clip.chromaKey != null;
  const setChroma = (patch: Partial<ChromaKey>) =>
    updateClips(selectedIds, { chromaKey: { ...chroma, ...patch } });

  const canTransition = canAddTransition(clips, clip);
  const maxTrans = maxTransitionDuration(clips, clip);
  // Show the controls always (so the feature is discoverable) but disable them
  // until the clip has an adjacent predecessor on its track to cross-fade from.
  const transitionDisabled = !canTransition && !clip.transition;

  const resetColor = !neutral && (
    <button
      onClick={() => updateClips(selectedIds, { color: undefined })}
      className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
    >
      Reset color
    </button>
  );

  const scopeNote = (
    <p className="text-xs leading-relaxed text-ink-faint">
      {count > 1
        ? `Effects apply to all ${count} selected clips.`
        : 'The preview matches the export: CSS/WebGL here, ffmpeg on render.'}
    </p>
  );

  if (sub === 'transition') {
    return (
      <div className="space-y-3">
        <div className="text-sm text-ink-muted">Transition in</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setClipTransition(clip.id, null)}
            disabled={transitionDisabled}
            className={cn(
              'rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              !clip.transition
                ? 'border-brand bg-brand/10 text-ink'
                : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
            )}
          >
            None
          </button>
          {TRANSITIONS.map((t) => {
            const on = clip.transition?.type === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setClipTransition(clip.id, t.id)}
                disabled={transitionDisabled}
                className={cn(
                  'rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  on
                    ? 'border-brand bg-brand/10 text-ink'
                    : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {clip.transition && (
          <Adjust
            label="Duration"
            value={clip.transition.duration}
            min={0.1}
            max={Math.max(0.2, maxTrans)}
            step={0.05}
            onChange={(v) => setClipTransition(clip.id, clip.transition!.type, v)}
            fmt={(v) => `${v.toFixed(2)}s`}
          />
        )}
        <p className="text-xs leading-relaxed text-ink-faint">
          {transitionDisabled
            ? 'Cross-fades this clip with the one right before it on the same track. Add a clip just before this one \u2014 split a clip (S) or drag two onto one track \u2014 then pick a style.'
            : 'Cross-fades in from the previous clip on this track. The clips overlap by the duration and the rest of the track shifts to fit.'}
        </p>
      </div>
    );
  }

  if (sub === 'background') {
    if (!isVideo) {
      return (
        <div className="space-y-2">
          <div className="text-sm text-ink-muted">Remove background</div>
          <p className="text-xs leading-relaxed text-ink-faint">
            Background removal (chroma key) works on video clips. Select a video to knock out a solid-color
            background.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Remove background</span>
          <button
            role="switch"
            aria-checked={keyOn}
            aria-label="Toggle chroma key"
            onClick={() =>
              updateClips(selectedIds, { chromaKey: keyOn ? undefined : { ...DEFAULT_CHROMA } })
            }
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors',
              keyOn ? 'bg-brand' : 'bg-surface-3',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                keyOn ? 'left-[22px]' : 'left-0.5',
              )}
            />
          </button>
        </div>

        {keyOn ? (
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-medium text-ink-muted">Key color</div>
              <div className="flex items-center gap-2">
                {CHROMA_SWATCHES.map((sw) => (
                  <button
                    key={sw}
                    onClick={() => setChroma({ color: sw })}
                    aria-label={`Key color ${sw}`}
                    style={{ backgroundColor: sw }}
                    className={cn(
                      'h-7 w-7 rounded-lg border-2 transition-transform hover:scale-105',
                      chroma.color.toLowerCase() === sw.toLowerCase() ? 'border-ink' : 'border-line',
                    )}
                  />
                ))}
                <label
                  title="Custom key color"
                  className="ml-1 grid h-7 w-7 cursor-pointer place-items-center overflow-hidden rounded-lg border border-line"
                >
                  <input
                    type="color"
                    value={chroma.color}
                    onChange={(e) => setChroma({ color: e.target.value })}
                    className="h-9 w-9 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
              </div>
            </div>
            <Adjust
              label="Similarity"
              value={chroma.similarity}
              min={0.05}
              max={1}
              step={0.01}
              onChange={(v) => setChroma({ similarity: v })}
              fmt={(v) => `${Math.round(v * 100)}%`}
            />
            <Adjust
              label="Edge blend"
              value={chroma.blend}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => setChroma({ blend: v })}
              fmt={(v) => `${Math.round(v * 100)}%`}
            />
            <p className="text-xs leading-relaxed text-ink-faint">
              The track below shows through where the color is removed. Keep this clip on a higher track,
              above your background.
            </p>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-ink-faint">
            Turn this on to knock out a solid-color background (e.g. a green screen) and reveal the track
            below.
          </p>
        )}
      </div>
    );
  }

  if (sub === 'adjust') {
    return (
      <div className="space-y-5">
        <div className="space-y-4">
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
        {resetColor}
        {scopeNote}
      </div>
    );
  }

  // Default: 'filters' — quick-look presets.
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
      {resetColor}
      {scopeNote}
    </div>
  );
}
