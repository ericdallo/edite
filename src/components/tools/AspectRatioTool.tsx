import { ASPECT_RATIOS } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';

function RatioGlyph({ ratio }: { ratio: number }) {
  const w = ratio >= 1 ? 26 : 26 * ratio;
  const h = ratio >= 1 ? 26 / ratio : 26;
  return (
    <div className="grid h-7 w-7 shrink-0 place-items-center">
      <div className="rounded-[3px] border-2 border-current" style={{ width: w, height: h }} />
    </div>
  );
}

export function AspectRatioTool() {
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);

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
                selected ? 'border-brand bg-brand/10 text-brand-bright' : 'border-line bg-surface-2 text-ink-faint hover:bg-surface-3',
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
      <p className="text-xs leading-relaxed text-ink-faint">
        Sets the output canvas. Clips scale to fill it — use Transform to resize or reposition a clip
        within the frame.
      </p>
    </div>
  );
}
