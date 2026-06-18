import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

const PRESETS: { label: string; ratio: number | null }[] = [
  { label: 'Free', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '4:5', ratio: 4 / 5 },
  { label: '4:3', ratio: 4 / 3 },
];

export function CropTool() {
  const crop = useEditorStore((s) => s.crop);
  const setCrop = useEditorStore((s) => s.setCrop);
  const source = useEditorStore((s) => s.source);

  const applyRatio = (ratio: number | null) => {
    if (ratio === null) {
      setCrop({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
      return;
    }
    const sw = source?.width ?? 16;
    const sh = source?.height ?? 9;
    const srcR = sw / sh;
    let w = 1;
    let h = 1;
    if (ratio > srcR) h = srcR / ratio;
    else w = ratio / srcR;
    setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-ink-faint">
        Drag the box on the video to crop. Start from a ratio:
      </p>

      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyRatio(p.ratio)}
            className="rounded-xl border border-line bg-surface-2 px-2 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            {p.label}
          </button>
        ))}
      </div>

      {crop && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3 text-xs text-ink-muted">
          <div className="flex items-center justify-between">
            <span>Crop size</span>
            <span className="font-mono text-ink">
              {Math.round(crop.width * (source?.width ?? 0))}×
              {Math.round(crop.height * (source?.height ?? 0))}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Position</span>
            <span className="font-mono text-ink">
              {Math.round(crop.x * 100)}%, {Math.round(crop.y * 100)}%
            </span>
          </div>
        </div>
      )}

      <Button
        variant="subtle"
        size="sm"
        className={cn('w-full', !crop && 'opacity-50')}
        onClick={() => setCrop(null)}
        disabled={!crop}
      >
        Reset crop
      </Button>
    </div>
  );
}
