import { type PointerEvent as ReactPointerEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { Segment } from '@/types/editor';
import { clamp, cn } from '@/lib/utils';

export interface TimelineClipProps {
  segment: Segment;
  pxPerSec: number;
  minStart: number;
  maxEnd: number;
  active: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onTrim: (start: number, end: number) => void;
  onDelete: () => void;
}

export function TimelineClip({
  segment,
  pxPerSec,
  minStart,
  maxEnd,
  active,
  canDelete,
  onSelect,
  onTrim,
  onDelete,
}: TimelineClipProps) {
  const left = segment.start * pxPerSec;
  const width = Math.max(2, (segment.end - segment.start) * pxPerSec);

  const dragEdge = (edge: 'start' | 'end') => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const sx = e.clientX;
    const o = { start: segment.start, end: segment.end };
    const move = (ev: PointerEvent) => {
      const d = (ev.clientX - sx) / pxPerSec;
      if (edge === 'start') onTrim(clamp(o.start + d, minStart, o.end - 0.1), o.end);
      else onTrim(o.start, clamp(o.end + d, o.start + 0.1, maxEnd));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handleCls = cn(
    'absolute top-0 bottom-0 z-10 flex w-3 cursor-ew-resize items-center justify-center bg-brand transition-opacity',
    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
  );

  return (
    <div
      className={cn(
        'group absolute top-0 bottom-0 overflow-hidden rounded-md',
        active ? 'ring-2 ring-brand' : 'ring-1 ring-white/15 hover:ring-white/30',
      )}
      style={{ left, width }}
      onPointerDown={() => onSelect()}
    >
      <div
        className={cn('pointer-events-none absolute inset-0', active ? 'bg-brand/10' : 'bg-transparent')}
      />
      <div onPointerDown={dragEdge('start')} className={cn(handleCls, 'left-0 rounded-l-md')}>
        <div className="h-6 w-0.5 rounded bg-white" />
      </div>
      <div onPointerDown={dragEdge('end')} className={cn(handleCls, 'right-0 rounded-r-md')}>
        <div className="h-6 w-0.5 rounded bg-white" />
      </div>
      {canDelete && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-1.5 top-1.5 z-20 hidden rounded-md bg-black/60 p-1 text-white/90 transition-colors hover:bg-danger group-hover:block"
          aria-label="Remove this part"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
