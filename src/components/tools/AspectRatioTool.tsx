import { ASPECT_RATIOS, BACKGROUND_SWATCHES, resolveAspectRatio } from '@/types/editor';
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
  const media = useEditorStore((s) => s.media);
  const background = useEditorStore((s) => s.background);
  const setAspect = useEditorStore((s) => s.setAspect);
  const setBackground = useEditorStore((s) => s.setBackground);

  const originalRatio = resolveAspectRatio('original', media);
  const isOriginal = aspect === 'original';

  return (
    <div className="space-y-4">
      <button
        onClick={() => setAspect('original')}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
          isOriginal ? 'border-brand bg-brand/10 text-brand-bright' : 'border-line bg-surface-2 text-ink-faint hover:bg-surface-3',
        )}
      >
        <RatioGlyph ratio={originalRatio} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">Original</div>
          <div className="truncate text-[11px] text-ink-faint">Match the source — no cropping</div>
        </div>
      </button>

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
        Sets the output canvas. <span className="text-ink-muted">Original</span> keeps your video&rsquo;s
        shape; the presets crop clips to fit. Use Transform to reposition a clip within the frame.
      </p>

      <div className="border-t border-line pt-4">
        <div className="mb-2 text-xs font-medium text-ink-muted">Background</div>
        <div className="flex flex-wrap items-center gap-2">
          {BACKGROUND_SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setBackground(c)}
              aria-label={`Background ${c}`}
              className={cn(
                'h-7 w-7 rounded-full border transition-transform hover:scale-110',
                background.toLowerCase() === c ? 'border-white ring-2 ring-brand' : 'border-black/40',
              )}
              style={{ background: c }}
            />
          ))}
          <label className="relative h-7 w-7 overflow-hidden rounded-full border border-line" title="Custom color">
            <span
              className="block h-full w-full"
              style={{ background: 'conic-gradient(from 180deg, #f43f5e, #fbbf24, #34d399, #22d3ee, #8b5cf6, #f43f5e)' }}
            />
            <input
              type="color"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Custom background color"
            />
          </label>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          Fills the canvas behind clips that don&rsquo;t cover the whole frame.
        </p>
      </div>
    </div>
  );
}
