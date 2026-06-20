import { ArrowRight, Circle, Diamond, type LucideIcon, Square, Star, Triangle } from 'lucide-react';
import {
  BACKGROUND_SWATCHES,
  DEFAULT_SHAPE_STYLE,
  SHAPES,
  type ShapeKind,
  type ShapeStyle,
} from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/Slider';

const SHAPE_ICONS: Record<ShapeKind, LucideIcon> = {
  rectangle: Square,
  ellipse: Circle,
  triangle: Triangle,
  diamond: Diamond,
  star: Star,
  arrow: ArrowRight,
};

function Row({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-ink-muted">{label}</span>
        <span className="font-mono text-ink">{Math.round(value * 100)}%</span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-ink-muted">{label}</div>
      <div className="flex flex-wrap items-center gap-2">
        {BACKGROUND_SWATCHES.map((sw) => (
          <button
            key={sw}
            onClick={() => onChange(sw)}
            aria-label={`${label} ${sw}`}
            style={{ backgroundColor: sw }}
            className={cn(
              'h-7 w-7 rounded-lg border-2 transition-transform hover:scale-105',
              value.toLowerCase() === sw.toLowerCase() ? 'border-ink' : 'border-line',
            )}
          />
        ))}
        <label className="ml-1 grid h-7 w-7 cursor-pointer place-items-center overflow-hidden rounded-lg border border-line">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-9 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
      </div>
    </div>
  );
}

export function ShapeTool() {
  const activeId = useEditorStore((s) => s.activeClipId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const clips = useEditorStore((s) => s.clips);
  const addShapeClip = useEditorStore((s) => s.addShapeClip);
  const updateClips = useEditorStore((s) => s.updateClips);
  const clip = clips.find((c) => c.id === activeId);
  const shape = clip?.shape;

  const palette = (
    <div>
      <div className="mb-2 text-sm text-ink-muted">Add a shape</div>
      <div className="grid grid-cols-3 gap-2">
        {SHAPES.map((s) => {
          const Icon = SHAPE_ICONS[s.kind];
          return (
            <button
              key={s.kind}
              onClick={() => addShapeClip(s.kind)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-2 py-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <Icon size={20} className="text-ink" />
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!shape) {
    return (
      <div className="space-y-4">
        {palette}
        <p className="text-xs leading-relaxed text-ink-faint">
          Shapes are vector overlays. Add one, then drag and resize it on the preview (Layout ▸ Transform) and
          animate it (Animate).
        </p>
      </div>
    );
  }

  const set = (patch: Partial<ShapeStyle>) => updateClips(selectedIds, { shape: { ...shape, ...patch } });
  const filled = shape.fill !== 'none';

  return (
    <div className="space-y-5">
      {palette}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Fill</span>
          <button
            onClick={() => set({ fill: filled ? 'none' : DEFAULT_SHAPE_STYLE.fill })}
            className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
          >
            {filled ? 'No fill' : 'Add fill'}
          </button>
        </div>
        {filled && <ColorField label="Fill color" value={shape.fill} onChange={(v) => set({ fill: v })} />}
        <ColorField
          label="Outline color"
          value={shape.stroke}
          onChange={(v) => set({ stroke: v, strokeWidth: shape.strokeWidth || 0.04 })}
        />
        <Row
          label="Outline width"
          value={shape.strokeWidth}
          min={0}
          max={0.2}
          step={0.005}
          onChange={(v) => set({ strokeWidth: v })}
        />
        {shape.kind === 'rectangle' && (
          <Row
            label="Corner radius"
            value={shape.radius}
            min={0}
            max={0.5}
            step={0.01}
            onChange={(v) => set({ radius: v })}
          />
        )}
      </div>
      <p className="text-xs leading-relaxed text-ink-faint">
        Resize and place the shape with Layout ▸ Transform; add keyframes or an in/out under Animate.
      </p>
    </div>
  );
}
