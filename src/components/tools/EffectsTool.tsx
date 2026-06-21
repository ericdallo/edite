import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  Aperture,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  ArrowUp,
  ArrowUpToLine,
  Ban,
  Blend,
  Check,
  type LucideIcon,
  Moon,
  Sparkles,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import {
  BLEND_MODES,
  CHROMA_SWATCHES,
  type ChromaKey,
  type ColorAdjust,
  DEFAULT_CHROMA,
  NEUTRAL_COLOR,
  TRANSITIONS,
  type TransitionId,
  type VideoEffects,
} from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';

const TRANSITION_ICONS: Record<TransitionId, LucideIcon> = {
  dissolve: Blend,
  fadeBlack: Moon,
  fadeWhite: Sun,
  slideLeft: ArrowLeft,
  slideRight: ArrowRight,
  slideUp: ArrowUp,
  slideDown: ArrowDown,
  wipeLeft: ArrowLeftToLine,
  wipeRight: ArrowRightToLine,
  wipeUp: ArrowUpToLine,
  wipeDown: ArrowDownToLine,
  circleOpen: Aperture,
};
import { isNeutralColor } from '@/lib/color';
import { isNeutralEffects } from '@/lib/effects';
import { LUT_ORIGINAL_THUMB, lutsByCategory, lutThumbUrl } from '@/lib/lut';
import { renderCustomLutThumb } from '@/lib/lutThumb';
import { canAddTransition, maxTransitionDuration } from '@/lib/timeline';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/Slider';

/** Percent of a ×-multiplier knob (1 = 100%). */
const pct = (v: number) => `${Math.round(v * 100)}%`;
/** Signed readout for a -100..100 grade slider (0 = neutral). */
const signed = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}`;
/** Degrees readout. */
const deg = (v: number) => `${Math.round(v)}\u00b0`;
/** Plain 0..100 amount. */
const amt = (v: number) => `${Math.round(v)}`;

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

/** One filter in the library: a graded sample thumbnail with a label. */
function FilterTile({
  label,
  thumb,
  selected,
  onClick,
  title,
  onRemove,
}: {
  label: string;
  /** thumbnail URL, or null to draw a generic swatch (custom LUTs). */
  thumb: string | null;
  selected: boolean;
  onClick: () => void;
  title?: string;
  onRemove?: () => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        title={title ?? label}
        className={cn(
          'group block w-full overflow-hidden rounded-lg border text-left transition-colors',
          selected ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-ink-faint',
        )}
      >
        <div className="relative aspect-square w-full bg-surface-3">
          {thumb ? (
            <img src={thumb} alt="" draggable={false} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-brand/30 to-accent/20" />
          )}
          {selected && !onRemove && (
            <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-brand text-white shadow">
              <Check size={11} />
            </span>
          )}
        </div>
        <div className={cn('truncate px-1.5 py-1 text-[11px] font-medium', selected ? 'text-ink' : 'text-ink-muted')}>
          {label}
        </div>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="absolute right-1 top-1 rounded bg-black/55 p-0.5 text-white/90 transition-colors hover:bg-black/75"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** A custom (imported) LUT tile: renders its thumbnail from the .cube at runtime. */
function CustomFilterTile({
  cube,
  label,
  selected,
  onClick,
  onRemove,
}: {
  cube: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    renderCustomLutThumb(cube)
      .then((url) => alive && setThumb(url))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [cube]);
  return (
    <FilterTile label={label} title={label} thumb={thumb} selected={selected} onClick={onClick} onRemove={onRemove} />
  );
}

export function EffectsTool({ sub = 'filters' }: { sub?: string }) {
  const activeId = useEditorStore((s) => s.activeClipId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const clips = useEditorStore((s) => s.clips);
  const media = useEditorStore((s) => s.media);
  const updateClips = useEditorStore((s) => s.updateClips);
  const setClipTransition = useEditorStore((s) => s.setClipTransition);
  const customLuts = useEditorStore((s) => s.customLuts);
  const importLut = useEditorStore((s) => s.importLut);
  const removeLut = useEditorStore((s) => s.removeLut);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lutError, setLutError] = useState<string | null>(null);
  const clip = clips.find((c) => c.id === activeId);

  if (!clip) {
    return <p className="text-sm text-ink-faint">Select a clip on the timeline to color grade it.</p>;
  }

  if (clip.text || clip.shape || clip.audioOnly) {
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
  // A look exists to dial back when the grade params are non-neutral, regardless
  // of the current intensity (so pulling intensity to 0 doesn't hide the slider).
  const hasLook = clip.color != null && !isNeutralColor({ ...clip.color, intensity: 1 });
  const set = (patch: Partial<ColorAdjust>) => updateClips(selectedIds, { color: { ...color, ...patch } });
  const effects: VideoEffects = clip.effects ?? {};
  const setFx = (patch: Partial<VideoEffects>) => updateClips(selectedIds, { effects: { ...effects, ...patch } });
  const setLut = (id?: string) => {
    const next = { ...color, lut: id };
    updateClips(selectedIds, { color: id == null && isNeutralColor(next) ? undefined : next });
  };
  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const name = file.name.replace(/\.cube$/i, '').slice(0, 40) || 'Custom';
      setLut(importLut(name, text));
      setLutError(null);
    } catch {
      setLutError('That file is not a valid .cube LUT.');
    }
  };

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
              'flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              !clip.transition
                ? 'border-brand bg-brand/10 text-ink'
                : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
            )}
          >
            <Ban size={14} className="shrink-0" />
            None
          </button>
          {TRANSITIONS.map((t) => {
            const on = clip.transition?.type === t.id;
            const Icon = TRANSITION_ICONS[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setClipTransition(clip.id, t.id)}
                disabled={transitionDisabled}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  on
                    ? 'border-brand bg-brand/10 text-ink'
                    : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
                )}
              >
                <Icon size={14} className="shrink-0" />
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
    const ext = {
      temperature: color.temperature ?? 0,
      tint: color.tint ?? 0,
      exposure: color.exposure ?? 0,
      highlights: color.highlights ?? 0,
      shadows: color.shadows ?? 0,
      sharpen: color.sharpen ?? 0,
      vignette: color.vignette ?? 0,
    };
    const heading = 'text-[11px] font-semibold uppercase tracking-wide text-ink-faint';
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className={heading}>Light</div>
          <Adjust
            label="Exposure"
            value={ext.exposure}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => set({ exposure: v })}
            fmt={signed}
          />
          <Adjust
            label="Brightness"
            value={color.brightness}
            min={0.5}
            max={1.5}
            step={0.01}
            onChange={(v) => set({ brightness: v })}
            fmt={pct}
          />
          <Adjust
            label="Contrast"
            value={color.contrast}
            min={0.5}
            max={1.5}
            step={0.01}
            onChange={(v) => set({ contrast: v })}
            fmt={pct}
          />
          <Adjust
            label="Highlights"
            value={ext.highlights}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => set({ highlights: v })}
            fmt={signed}
          />
          <Adjust
            label="Shadows"
            value={ext.shadows}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => set({ shadows: v })}
            fmt={signed}
          />
        </div>
        <div className="space-y-4">
          <div className={heading}>Colour</div>
          <Adjust
            label="Temperature"
            value={ext.temperature}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => set({ temperature: v })}
            fmt={signed}
          />
          <Adjust
            label="Tint"
            value={ext.tint}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => set({ tint: v })}
            fmt={signed}
          />
          <Adjust
            label="Saturation"
            value={color.saturation}
            min={0}
            max={2}
            step={0.01}
            onChange={(v) => set({ saturation: v })}
            fmt={pct}
          />
          <Adjust
            label="Hue"
            value={color.hue}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => set({ hue: v })}
            fmt={deg}
          />
        </div>
        <div className="space-y-4">
          <div className={heading}>Effects</div>
          <Adjust
            label="Sharpen"
            value={ext.sharpen}
            min={0}
            max={100}
            step={1}
            onChange={(v) => set({ sharpen: v })}
            fmt={amt}
          />
          <Adjust
            label="Vignette"
            value={ext.vignette}
            min={0}
            max={100}
            step={1}
            onChange={(v) => set({ vignette: v })}
            fmt={amt}
          />
        </div>
        {resetColor}
        {scopeNote}
      </div>
    );
  }

  if (sub === 'effects') {
    const fx: Required<VideoEffects> = {
      blur: effects.blur ?? 0,
      pixelate: effects.pixelate ?? 0,
      rgbSplit: effects.rgbSplit ?? 0,
      grain: effects.grain ?? 0,
    };
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Adjust
            label="Blur"
            value={fx.blur}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setFx({ blur: v })}
            fmt={amt}
          />
          <Adjust
            label="Pixelate"
            value={fx.pixelate}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setFx({ pixelate: v })}
            fmt={amt}
          />
          <Adjust
            label="RGB split"
            value={fx.rgbSplit}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setFx({ rgbSplit: v })}
            fmt={amt}
          />
          <Adjust
            label="Grain"
            value={fx.grain}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setFx({ grain: v })}
            fmt={amt}
          />
        </div>
        {!isNeutralEffects(clip.effects) && (
          <button
            onClick={() => updateClips(selectedIds, { effects: undefined })}
            className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
          >
            Reset effects
          </button>
        )}
        {scopeNote}
      </div>
    );
  }

  if (sub === 'blend') {
    const active = clip.blendMode;
    const btn = (on: boolean) =>
      cn(
        'rounded-xl border px-2 py-2 text-xs font-medium transition-colors',
        on
          ? 'border-brand bg-brand/10 text-ink'
          : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
      );
    return (
      <div className="space-y-3">
        <div className="text-sm text-ink-muted">Blend mode</div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => updateClips(selectedIds, { blendMode: undefined })}
            className={cn(btn(!active), 'flex items-center justify-center gap-1.5')}
          >
            <Ban size={14} className="shrink-0" />
            None
          </button>
          {BLEND_MODES.map((b) => (
            <button
              key={b.id}
              onClick={() => updateClips(selectedIds, { blendMode: b.id })}
              className={btn(active === b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-ink-faint">
          Mixes this clip with the tracks below it — put it on a higher track over your base video for
          light leaks, glows and textures.{count > 1 ? ` Applies to all ${count} selected clips.` : ''}
        </p>
      </div>
    );
  }

  // Default: 'filters' — one unified library of thumbnailed looks + intensity.
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-ink-muted">Filters</span>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-ink"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <FilterTile
            label="None"
            thumb={LUT_ORIGINAL_THUMB}
            selected={!clip.color?.lut}
            onClick={() => setLut(undefined)}
          />
        </div>
        {lutError && <p className="mt-2 text-xs text-rose-400">{lutError}</p>}
        <input ref={fileRef} type="file" accept=".cube" onChange={onImportFile} className="hidden" />
      </div>

      {lutsByCategory().map((group) => (
        <div key={group.category}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            {group.category}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {group.looks.map((l) => (
              <FilterTile
                key={l.id}
                label={l.label}
                thumb={lutThumbUrl(l.id)}
                selected={clip.color?.lut === l.id}
                onClick={() => setLut(l.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {customLuts.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Your LUTs
          </div>
          <div className="grid grid-cols-3 gap-2">
            {customLuts.map((l) => (
              <CustomFilterTile
                key={l.id}
                cube={l.cube}
                label={l.name}
                selected={clip.color?.lut === l.id}
                onClick={() => setLut(l.id)}
                onRemove={() => removeLut(l.id)}
              />
            ))}
          </div>
        </div>
      )}

      {hasLook && (
        <Adjust
          label="Intensity"
          value={color.intensity ?? 1}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set({ intensity: v })}
          fmt={pct}
        />
      )}
      {resetColor}
      {scopeNote}
    </div>
  );
}
