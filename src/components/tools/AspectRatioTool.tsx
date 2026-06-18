import { ASPECT_RATIOS } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';

function RatioGlyph({ ratio }: { ratio: number | null }) {
  const r = ratio ?? 16 / 9;
  const w = r >= 1 ? 26 : 26 * r;
  const h = r >= 1 ? 26 / r : 26;
  return (
    <div className="grid h-7 w-7 shrink-0 place-items-center">
      <div className="rounded-[3px] border-2 border-current" style={{ width: w, height: h }} />
    </div>
  );
}

export function AspectRatioTool() {
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);
  const aspectMode = useEditorStore((s) => s.aspectMode);
  const setAspectMode = useEditorStore((s) => s.setAspectMode);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        {ASPECT_RATIOS.map((a) => {
          const selected = aspect === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setAspect(a.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                selected
                  ? 'border-brand bg-brand/10 text-brand-bright'
                  : 'border-line bg-surface-2 text-ink-faint hover:bg-surface-3',
              )}
            >
              <RatioGlyph ratio={a.ratio} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{a.label}</div>
                <div className="truncate text-[11px] text-ink-faint">{a.hint}</div>
              </div>
            </button>
          );
        })}
      </div>

      {aspect !== 'original' && (
        <div>
          <div className="mb-2 text-sm text-ink-muted">Fit mode</div>
          <div className="grid grid-cols-2 gap-2">
            {(['fill', 'fit'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setAspectMode(m)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  aspectMode === m
                    ? 'border-brand bg-brand/10 text-ink'
                    : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
                )}
              >
                {m === 'fill' ? 'Fill · crop' : 'Fit · bars'}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-ink-faint">
        “Fill” crops the video to fill the new frame. “Fit” scales it down and adds black bars so
        nothing is lost.
      </p>
    </div>
  );
}
