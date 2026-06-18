import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Scissors, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { sortSegments } from '@/lib/segments';
import { generateThumbnails, type Thumbnail } from '@/lib/media/thumbnails';
import { clamp, formatClock } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PlaybackControls } from '@/components/preview/PlaybackControls';
import { TimelineClip } from './TimelineClip';
import { Playhead } from './Playhead';
import { ZoomControls } from './ZoomControls';

function niceStep(pxPerSec: number): number {
  if (pxPerSec <= 0) return 0;
  const target = 80 / pxPerSec;
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  return steps.find((s) => s >= target) ?? 600;
}

interface GapsProps {
  sorted: { start: number; end: number }[];
  duration: number;
  pxPerSec: number;
}

function Gaps({ sorted, duration, pxPerSec }: GapsProps) {
  const gaps: [number, number][] = [];
  let cursor = 0;
  for (const s of sorted) {
    if (s.start > cursor) gaps.push([cursor, s.start]);
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < duration) gaps.push([cursor, duration]);

  return (
    <>
      {gaps.map(([a, b], i) => (
        <div
          key={i}
          className="absolute bottom-0 top-6 bg-canvas/75"
          style={{ left: a * pxPerSec, width: (b - a) * pxPerSec }}
        >
          <div className="h-full w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,0.04)_6px,rgba(255,255,255,0.04)_12px)]" />
        </div>
      ))}
    </>
  );
}

export function Timeline() {
  const source = useEditorStore((s) => s.source);
  const sourceUrl = useEditorStore((s) => s.sourceUrl);
  const segments = useEditorStore((s) => s.segments);
  const activeId = useEditorStore((s) => s.activeSegmentId);
  const zoom = useEditorStore((s) => s.zoom);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setActiveSegment = useEditorStore((s) => s.setActiveSegment);
  const trimSegment = useEditorStore((s) => s.trimSegment);
  const deleteSegment = useEditorStore((s) => s.deleteSegment);
  const splitAt = useEditorStore((s) => s.splitAt);
  const resetSegments = useEditorStore((s) => s.resetSegments);

  const duration = source?.duration ?? 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pxPerSec = duration > 0 && viewW > 0 ? Math.max(6, (viewW / duration) * zoom) : 0;
  const trackW = duration * pxPerSec;

  const [thumbs, setThumbs] = useState<Thumbnail[]>([]);
  useEffect(() => {
    if (!sourceUrl || duration <= 0) {
      setThumbs([]);
      return;
    }
    const controller = new AbortController();
    const count = Math.min(48, Math.max(8, Math.round(duration / 1.5)));
    generateThumbnails(sourceUrl, duration, count, { width: 160, signal: controller.signal })
      .then((t) => {
        if (!controller.signal.aborted) setThumbs(t);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [sourceUrl, duration]);

  const sorted = useMemo(() => sortSegments(segments), [segments]);
  const tickStep = niceStep(pxPerSec);

  const timeFromPointer = (clientX: number) => {
    const el = contentRef.current;
    if (!el || pxPerSec <= 0) return 0;
    const rect = el.getBoundingClientRect();
    return clamp((clientX - rect.left) / pxPerSec, 0, duration);
  };

  const scrub = (e: ReactPointerEvent) => {
    if (pxPerSec <= 0) return;
    setPlaying(false);
    setCurrentTime(timeFromPointer(e.clientX));
    const move = (ev: PointerEvent) => setCurrentTime(timeFromPointer(ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const grabPlayhead = (e: ReactPointerEvent) => {
    e.stopPropagation();
    scrub(e);
  };

  if (!source) return null;

  return (
    <div className="flex h-[212px] shrink-0 flex-col border-t border-line bg-surface/40">
      <div className="flex h-12 items-center gap-2 border-b border-line/60 px-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="subtle" onClick={() => splitAt(currentTime)}>
            <Scissors size={15} /> Split
          </Button>
          <button
            onClick={() => activeId && deleteSegment(activeId)}
            disabled={sorted.length <= 1}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
            aria-label="Remove selected part"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={resetSegments}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Reset all cuts"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="mx-auto">
          <PlaybackControls />
        </div>

        <ZoomControls />
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden">
        <div
          ref={contentRef}
          className="relative h-full select-none"
          style={{ width: trackW || '100%' }}
          onPointerDown={scrub}
        >
          <div className="pointer-events-none relative h-6 border-b border-line/40 text-[10px] text-ink-faint">
            {tickStep > 0 &&
              Array.from({ length: Math.floor(duration / tickStep) + 1 }).map((_, i) => {
                const t = i * tickStep;
                return (
                  <div key={i} className="absolute top-0 h-full" style={{ left: t * pxPerSec }}>
                    <div className="h-1.5 w-px bg-line" />
                    <span className="absolute left-1 top-1.5 whitespace-nowrap">{formatClock(t)}</span>
                  </div>
                );
              })}
          </div>

          <div className="absolute bottom-0 left-0 right-0 top-6 flex overflow-hidden rounded-sm">
            {thumbs.length === 0 ? (
              <div className="h-full w-full animate-pulse bg-surface-3/40" />
            ) : (
              thumbs.map((t, i) => (
                <img
                  key={i}
                  src={t.url}
                  alt=""
                  draggable={false}
                  className="h-full min-w-0 flex-1 object-cover opacity-90"
                />
              ))
            )}
          </div>

          <Gaps sorted={sorted} duration={duration} pxPerSec={pxPerSec} />

          <div className="absolute bottom-0 left-0 right-0 top-6">
            {sorted.map((seg, i) => {
              const minStart = i > 0 ? sorted[i - 1].end : 0;
              const maxEnd = i < sorted.length - 1 ? sorted[i + 1].start : duration;
              return (
                <TimelineClip
                  key={seg.id}
                  segment={seg}
                  pxPerSec={pxPerSec}
                  minStart={minStart}
                  maxEnd={maxEnd}
                  active={seg.id === activeId}
                  canDelete={sorted.length > 1}
                  onSelect={() => setActiveSegment(seg.id)}
                  onTrim={(s, e) => trimSegment(seg.id, s, e)}
                  onDelete={() => deleteSegment(seg.id)}
                />
              );
            })}
          </div>

          <Playhead left={currentTime * pxPerSec} onGrab={grabPlayhead} />
        </div>
      </div>
    </div>
  );
}
