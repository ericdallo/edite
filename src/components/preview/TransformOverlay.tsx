import { type PointerEvent as ReactPointerEvent } from 'react';
import type { Rect } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { clamp, cn } from '@/lib/utils';

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
const MIN = 0.05;

export function TransformOverlay({ width, height }: { width: number; height: number }) {
  const activeId = useEditorStore((s) => s.activeClipId);
  const clips = useEditorStore((s) => s.clips);
  const setClipRect = useEditorStore((s) => s.setClipRect);
  const clip = clips.find((c) => c.id === activeId);
  if (!clip) return null;
  const r = clip.rect;

  const begin = (mode: Mode) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { ...r };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / width;
      const dy = (ev.clientY - sy) / height;
      const n: Rect = { ...o };
      if (mode === 'move') {
        n.x = clamp(o.x + dx, 0, 1 - o.w);
        n.y = clamp(o.y + dy, 0, 1 - o.h);
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
      setClipRect(clip.id, n);
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
        className="absolute cursor-move rounded-sm border-2 border-brand-bright shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
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
