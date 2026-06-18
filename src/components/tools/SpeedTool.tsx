import { Snowflake } from 'lucide-react';
import { SPEED_CURVES, SPEED_PRESETS, type SpeedCurveId } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { clipEnd } from '@/lib/timeline';
import { MIN_CLIP } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';

export function SpeedTool() {
  const activeId = useEditorStore((s) => s.activeClipId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const clips = useEditorStore((s) => s.clips);
  const media = useEditorStore((s) => s.media);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const setClipsSpeed = useEditorStore((s) => s.setClipsSpeed);
  const setClipCurve = useEditorStore((s) => s.setClipCurve);
  const freezeFrame = useEditorStore((s) => s.freezeFrame);
  const clip = clips.find((c) => c.id === activeId);

  if (!clip) {
    return <p className="text-sm text-ink-faint">Select a clip on the timeline to change its speed.</p>;
  }

  if (clip.freeze != null) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-ink">
          <Snowflake className="h-4 w-4 text-brand" />
          <span className="font-medium">Frozen frame</span>
        </div>
        <p className="text-xs leading-relaxed text-ink-faint">
          This clip holds a single frame. Drag its edges on the timeline to change how long the freeze lasts.
        </p>
      </div>
    );
  }

  const isVideo = media.find((m) => m.id === clip.mediaId)?.kind === 'video';
  const curveId = clip.speedCurve?.preset;
  const speed = clip.speed;
  const count = selectedIds.length;
  const setSpeed = (v: number) => setClipsSpeed(selectedIds, v);
  const canFreeze =
    isVideo && !clip.speedCurve && currentTime > clip.start + MIN_CLIP && currentTime < clipEnd(clip) - MIN_CLIP;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-sm text-ink-muted">Constant speed</div>
        <div className="grid grid-cols-3 gap-2">
          {SPEED_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setSpeed(p)}
              className={cn(
                'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                !curveId && Math.abs(speed - p) < 1e-3
                  ? 'border-brand bg-brand/10 text-ink'
                  : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
              )}
            >
              {p}×
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-ink-muted">Custom speed</span>
          <span className="font-mono text-ink">{speed.toFixed(2)}×</span>
        </div>
        <Slider min={0.25} max={4} step={0.05} value={speed} onChange={setSpeed} ariaLabel="Clip speed" />
      </div>

      {isVideo && (
        <div className="space-y-3 border-t border-line pt-4">
          <div className="text-sm text-ink-muted">Speed curve</div>
          <div className="grid grid-cols-3 gap-2">
            {SPEED_CURVES.map((c) => {
              const on = curveId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setClipCurve(selectedIds, on ? null : (c.id as SpeedCurveId))}
                  title={c.hint}
                  className={cn(
                    'rounded-xl border px-2 py-2 text-xs font-medium leading-tight transition-colors',
                    on
                      ? 'border-brand bg-brand/10 text-ink'
                      : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {curveId && (
            <button
              onClick={() => setClipCurve(selectedIds, null)}
              className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
            >
              Clear curve (back to constant speed)
            </button>
          )}

          <Button
            variant="secondary"
            size="md"
            className="w-full"
            disabled={!canFreeze}
            onClick={() => freezeFrame()}
            title="Hold the frame at the playhead (F)"
          >
            <Snowflake className="h-4 w-4" />
            Freeze frame at playhead
          </Button>
        </div>
      )}

      <p className="text-xs leading-relaxed text-ink-faint">
        {curveId
          ? 'The speed curve ramps this clip over its length; audio is time-stretched to match.'
          : count > 1
            ? `Applies to all ${count} selected clips and keeps them back-to-back. Audio is time-stretched to match.`
            : 'Higher speed shortens the clip on the timeline; audio is time-stretched to match.'}
      </p>
    </div>
  );
}
