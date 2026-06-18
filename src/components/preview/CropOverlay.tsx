import { type PointerEvent as ReactPointerEvent } from 'react';
import type { CropRect } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { clamp, cn } from '@/lib/utils';

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
const MIN = 0.06;

export interface CropOverlayProps {
  width: number;
  height: number;
}

export function CropOverlay({ width, height }: CropOverlayProps) {
  const crop = useEditorStore((s) => s.crop);
  const setCrop = useEditorStore((s) => s.setCrop);
  const r: CropRect = crop ?? { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };

  const begin = (mode: Mode) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const o = { ...r };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / width;
      const dy = (ev.clientY - sy) / height;
      const n: CropRect = { ...o };
      if (mode === 'move') {
        n.x = clamp(o.x + dx, 0, 1 - o.width);
        n.y = clamp(o.y + dy, 0, 1 - o.height);
      } else {
        if (mode === 'nw' || mode === 'sw') {
          const nx = clamp(o.x + dx, 0, o.x + o.width - MIN);
          n.x = nx;
          n.width = o.x + o.width - nx;
        }
        if (mode === 'ne' || mode === 'se') {
          n.width = clamp(o.width + dx, MIN, 1 - o.x);
        }
        if (mode === 'nw' || mode === 'ne') {
          const ny = clamp(o.y + dy, 0, o.y + o.height - MIN);
          n.y = ny;
          n.height = o.y + o.height - ny;
        }
        if (mode === 'sw' || mode === 'se') {
          n.height = clamp(o.height + dy, MIN, 1 - o.y);
        }
      }
      setCrop(n);
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
        className="absolute cursor-move border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
        style={{
          left: `${r.x * 100}%`,
          top: `${r.y * 100}%`,
          width: `${r.width * 100}%`,
          height: `${r.height * 100}%`,
        }}
        onPointerDown={begin('move')}
      >
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-white/15" />
          ))}
        </div>
        {corners.map((c) => (
          <div
            key={c.id}
            onPointerDown={begin(c.id)}
            className={cn('absolute h-3 w-3 rounded-full border border-black/20 bg-white shadow', c.cls)}
          />
        ))}
      </div>
    </div>
  );
}
