import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from 'react';
import { EyeOff, Music, Type, VolumeX } from 'lucide-react';
import type { Clip, MediaItem } from '@/types/editor';
import { clipTimelineDuration } from '@/lib/timeline';
import { generateThumbnails, type Thumbnail } from '@/lib/media/thumbnails';
import { clamp, cn } from '@/lib/utils';
import { Waveform } from './Waveform';

/** Drawn height (px) of a clip's waveform inside the timeline row. */
const WAVE_H = 44;

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
  const isText = clip.text != null;
  // A clip reads as audio when its media is audio, or it was detached from video.
  const isAudio = !!media && (media.kind === 'audio' || clip.audioOnly === true);
  const isVideo = media?.kind === 'video' && !clip.audioOnly;

  const [thumbs, setThumbs] = useState<Thumbnail[]>([]);
  const count = clamp(Math.round(width / 70), 1, 12);
  useEffect(() => {
    if (!media || media.kind !== 'video' || clip.audioOnly) {
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
    'absolute top-0 bottom-0 z-10 flex w-3.5 touch-none cursor-ew-resize items-center justify-center bg-brand transition-opacity lg:w-2.5',
    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
  );

  return (
    <div
      className={cn(
        'group absolute top-1 bottom-1 cursor-grab touch-none overflow-hidden rounded-md active:cursor-grabbing',
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
      <div className="absolute inset-0 flex items-center overflow-hidden bg-surface-3">
        {isText ? (
          <div className="flex h-full w-full items-center gap-1.5 bg-gradient-to-r from-brand/35 to-accent/20 px-2">
            <Type size={13} className="shrink-0 text-brand-bright" />
            <span className="truncate text-[11px] font-medium text-white/90">
              {clip.text?.content || 'Text'}
            </span>
          </div>
        ) : isAudio && media ? (
          <div className="relative flex h-full w-full items-center bg-gradient-to-r from-brand/30 to-accent/15">
            <Waveform
              mediaId={media.id}
              blob={media.blob}
              inSec={clip.in}
              outSec={clip.out}
              duration={media.duration}
              width={width}
              height={WAVE_H}
              className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2"
            />
            <Music size={13} className="relative ml-2 shrink-0 text-brand-bright" />
          </div>
        ) : isVideo ? (
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

      {clip.transition && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 border-l-2 border-brand bg-gradient-to-r from-brand/55 to-transparent"
          style={{ width: Math.max(6, Math.min(width, clip.transition.duration * pxPerSec)) }}
        />
      )}

      {clip.keyframes && clip.keyframes.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-2.5">
          {clip.keyframes.map((k, i) => (
            <span
              key={i}
              className="absolute top-0.5 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-accent shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
              style={{ left: clamp(k.at * pxPerSec, 0, width) }}
            />
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute left-1.5 top-1.5 flex gap-1">
        {clip.muted && !isText && (
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
