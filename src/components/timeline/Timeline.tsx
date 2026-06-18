import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Clipboard,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  Magnet,
  Plus,
  Scissors,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { clipSnapTargets, clipTimelineDuration, projectDuration, snapStart } from '@/lib/timeline';
import { ZOOM_MAX, ZOOM_MIN } from '@/lib/constants';
import { clamp, cn, formatClock } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { ContextMenu, type ContextMenuState, type MenuItem } from '@/components/ui/ContextMenu';
import { PlaybackControls } from '@/components/preview/PlaybackControls';
import { TimelineClip } from './TimelineClip';
import { Playhead } from './Playhead';
import { ZoomControls } from './ZoomControls';

const ROW_H = 56;

function niceStep(pxPerSec: number): number {
  if (pxPerSec <= 0) return 0;
  const target = 80 / pxPerSec;
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  return steps.find((s) => s >= target) ?? 600;
}

export function Timeline() {
  const media = useEditorStore((s) => s.media);
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const activeId = useEditorStore((s) => s.activeClipId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const clipboard = useEditorStore((s) => s.clipboard);
  const zoom = useEditorStore((s) => s.zoom);
  const snap = useEditorStore((s) => s.snap);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setActiveClip = useEditorStore((s) => s.setActiveClip);
  const toggleSelect = useEditorStore((s) => s.toggleSelect);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const moveClip = useEditorStore((s) => s.moveClip);
  const moveClipToNewTrack = useEditorStore((s) => s.moveClipToNewTrack);
  const setClipStarts = useEditorStore((s) => s.setClipStarts);
  const updateClip = useEditorStore((s) => s.updateClip);
  const updateClips = useEditorStore((s) => s.updateClips);
  const splitAt = useEditorStore((s) => s.splitAt);
  const duplicateClips = useEditorStore((s) => s.duplicateClips);
  const copyClips = useEditorStore((s) => s.copyClips);
  const pasteClips = useEditorStore((s) => s.pasteClips);
  const deleteClips = useEditorStore((s) => s.deleteClips);
  const addTrack = useEditorStore((s) => s.addTrack);
  const removeTrack = useEditorStore((s) => s.removeTrack);
  const setTrackMuted = useEditorStore((s) => s.setTrackMuted);
  const setTrackHidden = useEditorStore((s) => s.setTrackHidden);

  const displayDuration = Math.max(projectDuration(clips), 8);
  const hasSelection = selectedIds.length > 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(0);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [dragClipId, setDragClipId] = useState<string | null>(null);
  const [overNewTrack, setOverNewTrack] = useState(false);
  const pendingFocus = useRef<{ time: number; offset: number } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pxPerSec = displayDuration > 0 && viewW > 0 ? Math.max(6, (viewW / displayDuration) * zoom) : 0;
  const trackW = displayDuration * pxPerSec;

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pendingFocus.current && pxPerSec > 0) {
      el.scrollLeft = pendingFocus.current.time * pxPerSec - pendingFocus.current.offset;
      pendingFocus.current = null;
    }
  }, [pxPerSec]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (pxPerSec <= 0) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const contentX = e.clientX - rect.left + el.scrollLeft;
        pendingFocus.current = { time: contentX / pxPerSec, offset: e.clientX - rect.left };
        setZoom(clamp(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), ZOOM_MIN, ZOOM_MAX));
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        el.scrollLeft += e.deltaX;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [pxPerSec, zoom, setZoom]);

  const rowsTopOrder = [...tracks].reverse();

  const timeFromClientX = (clientX: number) => {
    const el = contentRef.current;
    if (!el || pxPerSec <= 0) return 0;
    return clamp((clientX - el.getBoundingClientRect().left) / pxPerSec, 0, displayDuration);
  };
  const trackFromClientY = (clientY: number): string | undefined => {
    const el = rowsRef.current;
    if (!el) return undefined;
    const idx = Math.floor((clientY - el.getBoundingClientRect().top) / ROW_H);
    return rowsTopOrder[clamp(idx, 0, rowsTopOrder.length - 1)]?.id;
  };

  // Empty area / ruler: press and drag to scrub the playhead. A plain click
  // (no drag) also clears the selection.
  const onAreaPointerDown = (e: ReactPointerEvent) => {
    if (pxPerSec <= 0) return;
    const startX = e.clientX;
    let moved = false;
    setPlaying(false);
    setCurrentTime(timeFromClientX(e.clientX));
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientX - startX) > 3) moved = true;
      setCurrentTime(timeFromClientX(ev.clientX));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) clearSelection();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onClipBodyDown = (e: ReactPointerEvent, clipId: string) => {
    e.stopPropagation();
    // Modifier-click toggles a clip in/out of the selection (no drag/seek).
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      toggleSelect(clipId);
      return;
    }
    const inSelection = selectedIds.includes(clipId);
    // Clicking a clip outside the current selection selects just it.
    if (!inSelection) setActiveClip(clipId);
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    const group = inSelection && selectedIds.length > 1;
    const startX = e.clientX;
    const startY = e.clientY;
    const dur = clipTimelineDuration(clip);

    // single-drag prep
    const origStart = clip.start;
    const targets = !group && snap ? clipSnapTargets(clips, clipId, currentTime) : [];
    // group-drag prep: capture every selected clip's origin so the translate has no drift
    const groupOrigins = group
      ? selectedIds.map((id) => ({ id, start: clips.find((c) => c.id === id)?.start ?? 0 }))
      : [];
    const minOrigin = group ? Math.min(...groupOrigins.map((o) => o.start)) : 0;

    let moved = false;
    let curStart = origStart;
    let toNewTrack = false;
    const move = (ev: PointerEvent) => {
      if (!moved && (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4)) {
        moved = true;
        if (!group) setDragClipId(clipId);
      }
      if (!moved) return;
      if (group) {
        // translate the whole selection, clamped so the earliest clip stays >= 0
        const delta = Math.max((ev.clientX - startX) / pxPerSec, -minOrigin);
        setClipStarts(groupOrigins.map((o) => ({ id: o.id, start: o.start + delta })));
        return;
      }
      let newStart = Math.max(0, origStart + (ev.clientX - startX) / pxPerSec);
      if (snap) newStart = snapStart(newStart, dur, targets, 8 / pxPerSec);
      curStart = newStart;
      // dropping below the last row creates a new track
      const rows = rowsRef.current?.getBoundingClientRect();
      toNewTrack = !!rows && ev.clientY > rows.bottom - 4;
      setOverNewTrack(toNewTrack);
      const trackId = toNewTrack
        ? useEditorStore.getState().clips.find((c) => c.id === clipId)?.trackId ?? clip.trackId
        : trackFromClientY(ev.clientY) ?? clip.trackId;
      moveClip(clipId, newStart, trackId);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) {
        // a plain click on a clip already in a multi-selection collapses to just it
        if (group) setActiveClip(clipId);
        setPlaying(false);
        setCurrentTime(timeFromClientX(ev.clientX));
      } else if (!group && toNewTrack) {
        moveClipToNewTrack(clipId, curStart, 'below');
      }
      setDragClipId(null);
      setOverNewTrack(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onHandleDown = (e: ReactPointerEvent, clipId: string, edge: 'in' | 'out') => {
    e.stopPropagation();
    setActiveClip(clipId);
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    const m = media.find((x) => x.id === clip.mediaId);
    const maxOut = m && m.kind === 'video' ? m.duration : Number.POSITIVE_INFINITY;
    const startX = e.clientX;
    const o = { start: clip.start, in: clip.in, out: clip.out, speed: clip.speed };
    setPlaying(false);
    const move = (ev: PointerEvent) => {
      const dxSec = ((ev.clientX - startX) / pxPerSec) * o.speed;
      if (edge === 'out') {
        const newOut = clamp(o.out + dxSec, o.in + 0.1, maxOut);
        updateClip(clipId, { out: newOut });
        // seek to the new out frame so the preview shows what is kept
        setCurrentTime(Math.max(o.start, o.start + (newOut - o.in) / o.speed - 0.03));
      } else {
        const newIn = clamp(o.in + dxSec, 0, o.out - 0.1);
        const newStart = Math.max(0, o.start + (newIn - o.in) / o.speed);
        updateClip(clipId, { in: newIn, start: newStart });
        setCurrentTime(newStart);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const grabPlayhead = (e: ReactPointerEvent) => {
    e.stopPropagation();
    if (pxPerSec <= 0) return;
    setPlaying(false);
    setCurrentTime(timeFromClientX(e.clientX));
    const move = (ev: PointerEvent) => setCurrentTime(timeFromClientX(ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const openClipMenu = (e: ReactMouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Right-clicking a clip outside the selection selects just it; otherwise act on the whole selection.
    const already = selectedIds.includes(id);
    if (!already) setActiveClip(id);
    const ids = already ? selectedIds : [id];
    const n = ids.length;
    const suffix = n > 1 ? ` ${n} clips` : '';
    const idSet = new Set(ids);
    const sel = clips.filter((c) => idSet.has(c.id));
    const allMuted = sel.length > 0 && sel.every((c) => c.muted);
    const allHidden = sel.length > 0 && sel.every((c) => c.hidden);
    const items: MenuItem[] = [
      { id: 'split', label: 'Split at playhead', icon: <Scissors size={14} />, shortcut: 'S', onClick: () => splitAt(currentTime) },
      { id: 'dup', label: `Duplicate${suffix}`, icon: <CopyPlus size={14} />, shortcut: '⌘D', onClick: () => duplicateClips(ids) },
      { id: 'copy', label: `Copy${suffix}`, icon: <Copy size={14} />, shortcut: '⌘C', onClick: () => copyClips(ids) },
      { id: 'paste', label: 'Paste', icon: <Clipboard size={14} />, shortcut: '⌘V', disabled: clipboard.length === 0, onClick: () => pasteClips(currentTime) },
      { id: 'mute', label: allMuted ? `Unmute${suffix}` : `Mute${suffix}`, icon: allMuted ? <Volume2 size={14} /> : <VolumeX size={14} />, separatorBefore: true, onClick: () => updateClips(ids, { muted: !allMuted }) },
      { id: 'hide', label: allHidden ? `Show${suffix}` : `Hide${suffix}`, icon: allHidden ? <Eye size={14} /> : <EyeOff size={14} />, onClick: () => updateClips(ids, { hidden: !allHidden }) },
      { id: 'del', label: `Delete${suffix}`, icon: <Trash2 size={14} />, shortcut: 'Del', danger: true, separatorBefore: true, onClick: () => deleteClips(ids) },
    ];
    setMenu({ x: e.clientX, y: e.clientY, items });
  };

  const openTrackMenu = (e: ReactMouseEvent, trackId: string) => {
    e.preventDefault();
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const at = timeFromClientX(e.clientX);
    const items: MenuItem[] = [
      { id: 'split', label: 'Split at playhead', icon: <Scissors size={14} />, shortcut: 'S', onClick: () => splitAt(currentTime) },
      { id: 'paste', label: 'Paste here', icon: <Clipboard size={14} />, shortcut: '⌘V', disabled: clipboard.length === 0, onClick: () => pasteClips(at) },
      { id: 'tmute', label: track.muted ? 'Unmute track' : 'Mute track', icon: track.muted ? <Volume2 size={14} /> : <VolumeX size={14} />, separatorBefore: true, onClick: () => setTrackMuted(trackId, !track.muted) },
      { id: 'thide', label: track.hidden ? 'Show track' : 'Hide track', icon: track.hidden ? <Eye size={14} /> : <EyeOff size={14} />, onClick: () => setTrackHidden(trackId, !track.hidden) },
      { id: 'tdel', label: 'Delete track', icon: <Trash2 size={14} />, danger: true, separatorBefore: true, onClick: () => removeTrack(trackId) },
    ];
    setMenu({ x: e.clientX, y: e.clientY, items });
  };

  const tickStep = niceStep(pxPerSec);

  return (
    <div className="flex h-[260px] shrink-0 flex-col border-t border-line bg-surface/40">
      <div className="flex h-12 items-center gap-2 border-b border-line/60 px-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="subtle" onClick={() => splitAt(currentTime)}>
            <Scissors size={15} /> Split
          </Button>
          <button
            onClick={() => hasSelection && duplicateClips(selectedIds)}
            disabled={!hasSelection}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
            aria-label="Duplicate selection"
          >
            <CopyPlus size={16} />
          </button>
          <button
            onClick={() => hasSelection && deleteClips(selectedIds)}
            disabled={!hasSelection}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
            aria-label="Delete selection"
          >
            <Trash2 size={16} />
          </button>
          {selectedIds.length > 1 && (
            <span className="ml-1 rounded-md bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand-bright">
              {selectedIds.length} selected
            </span>
          )}
          <button
            onClick={() => addTrack()}
            className="ml-1 flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Add track"
          >
            <Plus size={15} /> Track
          </button>
        </div>

        <div className="mx-auto">
          <PlaybackControls />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleSnap}
            title={snap ? 'Snapping on' : 'Snapping off'}
            aria-label="Toggle snapping"
            className={cn(
              'grid h-8 w-8 place-items-center rounded-lg transition-colors',
              snap ? 'bg-surface-3 text-brand-bright' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            <Magnet size={16} />
          </button>
          <ZoomControls />
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-auto overscroll-x-contain">
        <div ref={contentRef} className="relative select-none" style={{ width: trackW || '100%', minHeight: '100%' }}>
          <div
            className="sticky top-0 z-20 h-6 border-b border-line/40 bg-surface/80 text-[10px] text-ink-faint backdrop-blur"
            onPointerDown={onAreaPointerDown}
          >
            {tickStep > 0 &&
              Array.from({ length: Math.floor(displayDuration / tickStep) + 1 }).map((_, i) => {
                const t = i * tickStep;
                return (
                  <div key={i} className="absolute top-0 h-full" style={{ left: t * pxPerSec }}>
                    <div className="h-1.5 w-px bg-line" />
                    <span className="absolute left-1 top-1.5 whitespace-nowrap">{formatClock(t)}</span>
                  </div>
                );
              })}
          </div>

          <div ref={rowsRef}>
            {rowsTopOrder.length === 0 && (
              <div className="grid h-[120px] place-items-center text-sm text-ink-faint">
                Add media to create a track.
              </div>
            )}
            {rowsTopOrder.map((track) => (
              <div
                key={track.id}
                className="relative border-b border-line/40"
                style={{ height: ROW_H }}
                onPointerDown={onAreaPointerDown}
                onContextMenu={(e) => openTrackMenu(e, track.id)}
              >
                {(track.hidden || track.muted) && (
                  <div className="pointer-events-none absolute left-1.5 top-1.5 z-10 flex gap-1">
                    {track.hidden && (
                      <span className="grid h-5 w-5 place-items-center rounded bg-black/50 text-ink-muted">
                        <EyeOff size={12} />
                      </span>
                    )}
                    {track.muted && (
                      <span className="grid h-5 w-5 place-items-center rounded bg-black/50 text-danger">
                        <VolumeX size={12} />
                      </span>
                    )}
                  </div>
                )}
                {clips
                  .filter((c) => c.trackId === track.id)
                  .map((clip) => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      media={media.find((m) => m.id === clip.mediaId)}
                      pxPerSec={pxPerSec}
                      active={clip.id === activeId}
                      selected={selectedIds.includes(clip.id)}
                      onBodyDown={(e) => onClipBodyDown(e, clip.id)}
                      onHandleDown={(e, edge) => onHandleDown(e, clip.id, edge)}
                      onContext={(e) => openClipMenu(e, clip.id)}
                    />
                  ))}
              </div>
            ))}
          </div>

          {dragClipId && (
            <div
              className={cn(
                'relative mx-1 mb-1 rounded-xl border-2 border-dashed transition-colors',
                overNewTrack ? 'border-brand bg-brand/10' : 'border-line/60 bg-surface-2/20',
              )}
              style={{ height: ROW_H - 10 }}
            >
              {(() => {
                const dc = overNewTrack ? clips.find((c) => c.id === dragClipId) : undefined;
                return dc ? (
                  <div
                    className="pointer-events-none absolute inset-y-1 rounded-lg bg-brand/30 ring-1 ring-brand"
                    style={{
                      left: dc.start * pxPerSec,
                      width: Math.max(10, clipTimelineDuration(dc) * pxPerSec),
                    }}
                  />
                ) : (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs font-medium text-ink-faint">
                    Drop here to add a track
                  </span>
                );
              })()}
            </div>
          )}

          <Playhead left={currentTime * pxPerSec} onGrab={grabPlayhead} />
        </div>
      </div>

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
