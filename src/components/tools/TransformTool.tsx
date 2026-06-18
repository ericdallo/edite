import { useEditorStore } from '@/store/editorStore';
import { FULL_RECT, type Rect } from '@/types/editor';
import { Slider } from '@/components/ui/Slider';

const PRESETS: { label: string; rect: Rect }[] = [
  { label: 'Fill', rect: FULL_RECT },
  { label: 'Center', rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } },
  { label: 'Top-left', rect: { x: 0.04, y: 0.05, w: 0.33, h: 0.33 } },
  { label: 'Top-right', rect: { x: 0.63, y: 0.05, w: 0.33, h: 0.33 } },
  { label: 'Bottom-left', rect: { x: 0.04, y: 0.62, w: 0.33, h: 0.33 } },
  { label: 'Bottom-right', rect: { x: 0.63, y: 0.62, w: 0.33, h: 0.33 } },
];

export function TransformTool() {
  const activeId = useEditorStore((s) => s.activeClipId);
  const clips = useEditorStore((s) => s.clips);
  const setClipRect = useEditorStore((s) => s.setClipRect);
  const setClipOpacity = useEditorStore((s) => s.setClipOpacity);
  const clip = clips.find((c) => c.id === activeId);

  if (!clip) {
    return (
      <p className="text-sm text-ink-faint">
        Select a clip on the timeline to position and resize it on the canvas.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-ink-faint">
        Drag the box on the preview to move or resize this clip, or pick a layout:
      </p>
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setClipRect(clip.id, p.rect)}
            className="rounded-xl border border-line bg-surface-2 px-2 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-ink-muted">Opacity</span>
          <span className="font-mono text-ink">{Math.round(clip.opacity * 100)}%</span>
        </div>
        <Slider min={0} max={1} step={0.01} value={clip.opacity} onChange={(v) => setClipOpacity(clip.id, v)} ariaLabel="Clip opacity" />
      </div>
      <p className="text-xs leading-relaxed text-ink-faint">
        Use opacity and overlapping tracks to blend clips. Higher tracks render on top.
      </p>
    </div>
  );
}
