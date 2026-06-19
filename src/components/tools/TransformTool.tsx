import { type ReactNode } from 'react';
import { FlipHorizontal, FlipVertical, RotateCcw, RotateCw } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { FULL_RECT, type Rect } from '@/types/editor';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/Slider';

const norm = (deg: number): number => (((Math.round(deg / 90) * 90) % 360) + 360) % 360;

function OrientButton({
  active = false,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex h-10 items-center justify-center rounded-lg border transition-colors',
        active
          ? 'border-brand bg-brand/15 text-ink'
          : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

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
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const clips = useEditorStore((s) => s.clips);
  const updateClips = useEditorStore((s) => s.updateClips);
  const setSelectedSubtool = useEditorStore((s) => s.setSelectedSubtool);
  const clip = clips.find((c) => c.id === activeId);

  if (!clip) {
    return (
      <p className="text-sm text-ink-faint">
        Select a clip on the timeline to position and resize it on the canvas.
      </p>
    );
  }

  const count = selectedIds.length;
  const isMedia = !clip.text && !clip.shape;

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-ink-faint">
        Drag the box on the preview to move or resize this clip, or pick a layout:
      </p>
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => updateClips(selectedIds, { rect: p.rect })}
            className="rounded-xl border border-line bg-surface-2 px-2 py-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            {p.label}
          </button>
        ))}
      </div>
      {isMedia && (
        <div>
          <div className="mb-2 text-xs font-medium text-ink-muted">Orientation</div>
          <div className="grid grid-cols-4 gap-2">
            <OrientButton
              active={!!clip.flipH}
              label="Mirror horizontally"
              onClick={() => updateClips(selectedIds, { flipH: !clip.flipH })}
            >
              <FlipHorizontal size={16} />
            </OrientButton>
            <OrientButton
              active={!!clip.flipV}
              label="Flip vertically"
              onClick={() => updateClips(selectedIds, { flipV: !clip.flipV })}
            >
              <FlipVertical size={16} />
            </OrientButton>
            <OrientButton
              label="Rotate left"
              onClick={() => updateClips(selectedIds, { rotation: norm((clip.rotation || 0) - 90) })}
            >
              <RotateCcw size={16} />
            </OrientButton>
            <OrientButton
              label="Rotate right"
              onClick={() => updateClips(selectedIds, { rotation: norm((clip.rotation || 0) + 90) })}
            >
              <RotateCw size={16} />
            </OrientButton>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-ink-muted">Opacity</span>
          <span className="font-mono text-ink">{Math.round(clip.opacity * 100)}%</span>
        </div>
        <Slider min={0} max={1} step={0.01} value={clip.opacity} onChange={(v) => updateClips(selectedIds, { opacity: v })} ariaLabel="Clip opacity" />
      </div>

      {isMedia && (
        <p className="text-xs leading-relaxed text-ink-faint">
          Want motion? Switch to{' '}
          <button
            onClick={() => setSelectedSubtool('animate')}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Animate
          </button>{' '}
          to keyframe position &amp; size over time.
        </p>
      )}

      <p className="text-xs leading-relaxed text-ink-faint">
        {count > 1
          ? `Layout and opacity apply to all ${count} selected clips. The on-canvas box edits the primary one.`
          : 'Use opacity and overlapping tracks to blend clips. Higher tracks render on top.'}
      </p>
    </div>
  );
}
