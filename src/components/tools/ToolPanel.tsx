import {
  Crop,
  Gauge,
  type LucideIcon,
  MoveHorizontal,
  Ratio,
  Scissors,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useEditorStore, type ToolId } from '@/store/editorStore';
import { sortSegments } from '@/lib/segments';
import { cn, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { CropTool } from './CropTool';
import { SpeedTool } from './SpeedTool';
import { AspectRatioTool } from './AspectRatioTool';
import { MuteTool } from './MuteTool';

const META: Record<ToolId, { title: string; desc: string; icon: LucideIcon }> = {
  trim: { title: 'Trim', desc: 'Shorten or extend the clip', icon: MoveHorizontal },
  split: { title: 'Split & cut', desc: 'Cut into parts and remove some', icon: Scissors },
  crop: { title: 'Crop', desc: 'Frame a region of the video', icon: Crop },
  speed: { title: 'Speed', desc: 'Speed up or slow down', icon: Gauge },
  aspect: { title: 'Aspect ratio', desc: 'Reframe for any platform', icon: Ratio },
  mute: { title: 'Audio', desc: 'Mute or adjust the sound', icon: Volume2 },
};

function SegmentsPanel() {
  const segments = useEditorStore((s) => s.segments);
  const activeId = useEditorStore((s) => s.activeSegmentId);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const setActiveSegment = useEditorStore((s) => s.setActiveSegment);
  const deleteSegment = useEditorStore((s) => s.deleteSegment);
  const splitAt = useEditorStore((s) => s.splitAt);

  const sorted = sortSegments(segments);

  return (
    <div className="space-y-4">
      <Button variant="secondary" size="sm" className="w-full" onClick={() => splitAt(currentTime)}>
        <Scissors size={15} /> Split at playhead
      </Button>

      <div className="space-y-2">
        {sorted.map((s, i) => (
          <div
            key={s.id}
            onClick={() => setActiveSegment(s.id)}
            className={cn(
              'group flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
              s.id === activeId
                ? 'border-brand bg-brand/10'
                : 'border-line bg-surface-2 hover:bg-surface-3',
            )}
          >
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-3 text-xs font-semibold text-ink-muted">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs text-ink">
                {formatTime(s.start)} → {formatTime(s.end)}
              </div>
              <div className="text-[11px] text-ink-faint">{(s.end - s.start).toFixed(2)}s</div>
            </div>
            {sorted.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSegment(s.id);
                }}
                className="text-ink-faint transition-colors hover:text-danger"
                aria-label={`Remove part ${i + 1}`}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Drag the edges of a part on the timeline to trim. Use Split to cut, then remove the parts you
        don’t want.
      </p>
    </div>
  );
}

export function ToolPanel() {
  const tool = useEditorStore((s) => s.selectedTool);
  const source = useEditorStore((s) => s.source);
  const meta = META[tool];
  const Icon = meta.icon;

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-line bg-surface/30">
      <div className="flex items-center gap-3 border-b border-line px-4 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-surface-3 text-brand-bright">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">{meta.title}</h2>
          <p className="text-xs text-ink-faint">{meta.desc}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!source ? (
          <p className="text-sm text-ink-faint">Upload a video to start editing.</p>
        ) : tool === 'trim' || tool === 'split' ? (
          <SegmentsPanel />
        ) : tool === 'crop' ? (
          <CropTool />
        ) : tool === 'speed' ? (
          <SpeedTool />
        ) : tool === 'aspect' ? (
          <AspectRatioTool />
        ) : (
          <MuteTool />
        )}
      </div>
    </aside>
  );
}
