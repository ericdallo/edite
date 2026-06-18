import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from 'react';
import { EyeOff, VolumeX } from 'lucide-react';
import type { Clip, MediaItem } from '@/types/editor';
import { clipTimelineDuration } from '@/lib/timeline';
import { generateThumbnails, type Thumbnail } from '@/lib/media/thumbnails';
import { clamp, cn } from '@/lib/utils';

export interface TimelineClipProps {
  clip: Clip;
  media: MediaItem | undefined;
  pxPerSec: number;
  /** primary selection: gets trim handles. */
  active: boolean;
  /** part of the current (possibly multi) selection: gets a brand outline. */
  selected: boolean;
  onBodyDown: (e: ReactPointerEvent) => void;
  onHandleDown: (e: ReactPointerEvent, edge: 'in' | 'out') => void;
  onContext: (e: ReactMouseEvent) => void;
}

export function TimelineClip({ clip, media, pxPerSec, active, selected, onBodyDown, onHandleDown, onContext }: TimelineClipProps) {
  const width = Math.max(2, clipTimelineDuration(clip) * pxPerSec);
  const left = clip.start * pxPerSec;
  const isVideo = media?.kind === 'video';

  const [thumbs, setThumbs] = useState<Thumbnail[]>([]);
  const count = clamp(Math.round(width / 70), 1, 12);
  useEffect(() => {
    if (!media || media.kind !== 'video') {
      setThumbs([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      generateThumbnails(media.url, { from: clip.in, to: clip.out, count, width: 120, signal: controller.signal })
        .then((t) => {
          if (!controller.signal.aborted) setThumbs(t);
        })
        .catch(() => undefined);
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [media, clip.in, clip.out, count]);

  const handleCls = cn(
    'absolute top-0 bottom-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center bg-brand transition-opacity',
    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
  );

  return (
    <div
      className={cn(
        'group absolute top-1 bottom-1 cursor-grab overflow-hidden rounded-md active:cursor-grabbing',
        active
          ? 'z-10 ring-2 ring-brand'
          : selected
            ? 'z-10 ring-2 ring-brand/70'
            : 'ring-1 ring-white/15 hover:ring-white/30',
        clip.hidden && 'opacity-50',
      )}
      style={{ left, width }}
      onPointerDown={onBodyDown}
      onContextMenu={onContext}
    >
      <div className="absolute inset-0 flex overflow-hidden bg-surface-3">
        {isVideo ? (
          thumbs.map((t, i) => (
            <img key={i} src={t.url} alt="" draggable={false} className="h-full min-w-0 flex-1 object-cover" />
          ))
        ) : media ? (
          <img src={media.url} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : null}
      </div>

      {clip.hidden && (
        <div className="pointer-events-none absolute inset-0 bg-canvas/40 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,0.05)_6px,rgba(255,255,255,0.05)_12px)]" />
      )}
      <div className={cn('pointer-events-none absolute inset-0', active || selected ? 'bg-brand/10' : '')} />

      <div className="pointer-events-none absolute left-1.5 top-1.5 flex gap-1">
        {clip.muted && (
          <span className="grid h-5 w-5 place-items-center rounded bg-black/60 text-danger">
            <VolumeX size={12} />
          </span>
        )}
        {clip.hidden && (
          <span className="grid h-5 w-5 place-items-center rounded bg-black/60 text-ink-muted">
            <EyeOff size={12} />
          </span>
        )}
      </div>

      {media && (
        <div className="pointer-events-none absolute bottom-1 left-1.5 max-w-[calc(100%-12px)] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/90">
          {media.fileName}
        </div>
      )}

      <div onPointerDown={(e) => onHandleDown(e, 'in')} className={cn(handleCls, 'left-0 rounded-l-md')}>
        <div className="h-5 w-0.5 rounded bg-white" />
      </div>
      <div onPointerDown={(e) => onHandleDown(e, 'out')} className={cn(handleCls, 'right-0 rounded-r-md')}>
        <div className="h-5 w-0.5 rounded bg-white" />
      </div>
    </div>
  );
}
