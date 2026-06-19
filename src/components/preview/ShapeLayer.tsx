import { useEffect, useRef } from 'react';
import type { ShapeStyle } from '@/types/editor';
import { drawShape } from '@/lib/shape/render';

export interface ShapeLayerProps {
  shape: ShapeStyle;
  /** shape box size in CSS px. */
  boxW: number;
  boxH: number;
}

/** Draws a vector shape into a canvas using the same renderer as the export. */
export function ShapeLayer({ shape, boxW, boxH }: ShapeLayerProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const w = Math.max(1, Math.round(boxW));
    const h = Math.max(1, Math.round(boxH));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawShape(ctx, shape, { boxW: w, boxH: h });
  }, [shape, boxW, boxH]);

  return <canvas ref={ref} className="block h-full w-full" />;
}
