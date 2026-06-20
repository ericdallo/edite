import { type PointerEvent as ReactPointerEvent } from 'react';
import type { Rect } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { clipTransformAt } from '@/lib/timeline';
import { TEXT_SIZE_MAX, TEXT_SIZE_MIN } from '@/lib/constants';
import { clamp, cn } from '@/lib/utils';

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
const MIN = 0.05;

export function TransformOverlay({ width, height }: { width: number; height: number }) {
  const activeId = useEditorStore((s) => s.activeClipId);
  const clips = useEditorStore((s) => s.clips);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const setClipRect = useEditorStore((s) => s.setClipRect);
  const upsertKeyframe = useEditorStore((s) => s.upsertKeyframe);
  const updateClip = useEditorStore((s) => s.updateClip);
  const clip = clips.find((c) => c.id === activeId);
  if (!clip) return null;
  const isText = clip.text != null;
  // The box follows the animated placement at the playhead. A keyframed clip
  // edits the keyframe there (keeping aspect, so the export stays in sync);
  // otherwise it edits the static rect exactly as before.
  const r = clipTransformAt(clip, currentTime).rect;
  const animated = (clip.keyframes?.length ?? 0) >= 1;

  const apply = (n: Rect) => {
    if (animated) upsertKeyframe(clip.id, currentTime - clip.start, n);
    else setClipRect(clip.id, n);
  };

  const begin = (mode: Mode) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Capture the pointer so a touch drag isn't stolen by the page (scroll /
    // pinch); the window move/up below still fire while the finger is down.
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture can throw if the pointer is already gone; ignore.
    }
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { ...r };
    const aspect = o.w / o.h; // fraction ratio, kept constant while scaling
    const startFont = clip.text?.fontSize ?? 0;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / width;
      const dy = (ev.clientY - sy) / height;
      const n: Rect = { ...o };
      if (mode === 'move') {
        n.x = clamp(o.x + dx, 0, 1 - o.w);
        n.y = clamp(o.y + dy, 0, 1 - o.h);
        apply(n);
        return;
      }
      // Text and keyframed clips scale uniformly about the opposite corner: a
      // keyframed clip stays a pure scale + translate the export can reproduce,
      // and a text box keeps its aspect so its font can scale with it (below).
      if (animated || isText) {
        const signX = mode === 'ne' || mode === 'se' ? 1 : -1;
        const signY = mode === 'sw' || mode === 'se' ? 1 : -1;
        const grow = ((signX * dx) / o.w + (signY * dy) / o.h) / 2;
        const ax = mode === 'nw' || mode === 'sw' ? o.x + o.w : o.x;
        const ay = mode === 'nw' || mode === 'ne' ? o.y + o.h : o.y;
        const maxW = mode === 'nw' || mode === 'sw' ? ax : 1 - ax;
        const maxH = mode === 'nw' || mode === 'ne' ? ay : 1 - ay;
        let w = Math.max(MIN, o.w * (1 + grow));
        let h = w / aspect;
        if (w > maxW) {
          w = maxW;
          h = w / aspect;
        }
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        n.w = w;
        n.h = h;
        n.x = mode === 'nw' || mode === 'sw' ? ax - w : ax;
        n.y = mode === 'nw' || mode === 'ne' ? ay - h : ay;
        if (isText && !animated && clip.text) {
          // Scale the font with the box so resizing a text overlay grows/shrinks
          // the glyphs (the export reads fontSize too, so preview stays matched).
          const fontSize = clamp(startFont * (h / o.h), TEXT_SIZE_MIN, TEXT_SIZE_MAX);
          updateClip(clip.id, { rect: n, text: { ...clip.text, fontSize } });
        } else {
          apply(n);
        }
        return;
      }
      // Free resize (media & shapes): each edge moves independently.
      if (mode === 'nw' || mode === 'sw') {
        const nx = clamp(o.x + dx, 0, o.x + o.w - MIN);
        n.x = nx;
        n.w = o.x + o.w - nx;
      }
      if (mode === 'ne' || mode === 'se') n.w = clamp(o.w + dx, MIN, 1 - o.x);
      if (mode === 'nw' || mode === 'ne') {
        const ny = clamp(o.y + dy, 0, o.y + o.h - MIN);
        n.y = ny;
        n.h = o.y + o.h - ny;
      }
      if (mode === 'sw' || mode === 'se') n.h = clamp(o.h + dy, MIN, 1 - o.y);
      apply(n);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // Hit areas are 24px (comfortable on touch) with the visible 12px dot centred
  // on the corner, so the offset is half the hit area.
  const corners: { id: Mode; cls: string }[] = [
    { id: 'nw', cls: '-left-3 -top-3 cursor-nwse-resize' },
    { id: 'ne', cls: '-right-3 -top-3 cursor-nesw-resize' },
    { id: 'sw', cls: '-left-3 -bottom-3 cursor-nesw-resize' },
    { id: 'se', cls: '-right-3 -bottom-3 cursor-nwse-resize' },
  ];

  return (
    <div className="absolute inset-0 z-20">
      <div
        className={cn(
          'absolute cursor-move touch-none border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]',
          animated ? 'border-accent' : 'border-brand-bright',
        )}
        style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
        onPointerDown={begin('move')}
      >
        {corners.map((c) => (
          <div
            key={c.id}
            onPointerDown={begin(c.id)}
            aria-label="Resize"
            className={cn('absolute grid h-6 w-6 touch-none place-items-center', c.cls)}
          >
            <span className="block h-3 w-3 rounded-full border border-black/40 bg-white shadow" />
          </div>
        ))}
      </div>
    </div>
  );
}
