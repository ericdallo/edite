import { type PointerEvent as ReactPointerEvent } from 'react';
import type { Rect } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { clipTransformAt } from '@/lib/timeline';
import { clamp, cn } from '@/lib/utils';

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
const MIN = 0.05;

export function TransformOverlay({ width, height }: { width: number; height: number }) {
  const activeId = useEditorStore((s) => s.activeClipId);
  const clips = useEditorStore((s) => s.clips);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const setClipRect = useEditorStore((s) => s.setClipRect);
  const upsertKeyframe = useEditorStore((s) => s.upsertKeyframe);
  const clip = clips.find((c) => c.id === activeId);
  if (!clip) return null;
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
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { ...r };
    const aspect = o.w / o.h; // fraction ratio, kept constant while animating
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / width;
      const dy = (ev.clientY - sy) / height;
      const n: Rect = { ...o };
      if (mode === 'move') {
        n.x = clamp(o.x + dx, 0, 1 - o.w);
        n.y = clamp(o.y + dy, 0, 1 - o.h);
      } else if (animated) {
        // Uniform scale about the opposite corner: keeps the box's aspect so the
        // animation is a pure scale + translate the export can reproduce exactly.
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
      } else {
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
      }
      apply(n);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const corners: { id: Mode; cls: string }[] = [
    { id: 'nw', cls: '-left-1.5 -top-1.5 cursor-nwse-resize' },
    { id: 'ne', cls: '-right-1.5 -top-1.5 cursor-nesw-resize' },
    { id: 'sw', cls: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
    { id: 'se', cls: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
  ];

  return (
    <div className="absolute inset-0 z-20">
      <div
        className={cn(
          'absolute cursor-move rounded-sm border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]',
          animated ? 'border-accent' : 'border-brand-bright',
        )}
        style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
        onPointerDown={begin('move')}
      >
        {corners.map((c) => (
          <div
            key={c.id}
            onPointerDown={begin(c.id)}
            className={cn('absolute h-3 w-3 rounded-full border border-black/30 bg-white shadow', c.cls)}
          />
        ))}
      </div>
    </div>
  );
}
