import { SPEED_PRESETS } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/Slider';

export function SpeedTool() {
  const activeId = useEditorStore((s) => s.activeClipId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const clips = useEditorStore((s) => s.clips);
  const updateClips = useEditorStore((s) => s.updateClips);
  const clip = clips.find((c) => c.id === activeId);

  if (!clip) {
    return <p className="text-sm text-ink-faint">Select a clip on the timeline to change its speed.</p>;
  }
  const speed = clip.speed;
  const count = selectedIds.length;
  const setSpeed = (v: number) => updateClips(selectedIds, { speed: v });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {SPEED_PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setSpeed(p)}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
              Math.abs(speed - p) < 1e-3
                ? 'border-brand bg-brand/10 text-ink'
                : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
            )}
          >
            {p}×
          </button>
        ))}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-ink-muted">Custom speed</span>
          <span className="font-mono text-ink">{speed.toFixed(2)}×</span>
        </div>
        <Slider min={0.25} max={4} step={0.05} value={speed} onChange={setSpeed} ariaLabel="Clip speed" />
      </div>
      <p className="text-xs leading-relaxed text-ink-faint">
        {count > 1
          ? `Applies to all ${count} selected clips. Higher speed shortens them; audio is time-stretched to match.`
          : 'Higher speed shortens the clip on the timeline; audio is time-stretched to match.'}
      </p>
    </div>
  );
}
