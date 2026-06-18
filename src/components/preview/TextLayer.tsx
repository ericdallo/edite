import { useEffect, useRef } from 'react';
import type { TextStyle } from '@/types/editor';
import { drawText } from '@/lib/text/render';

export interface TextLayerProps {
  text: TextStyle;
  /** text box size in CSS px */
  boxW: number;
  boxH: number;
  /** full preview canvas height in CSS px (font size scales off this) */
  canvasH: number;
}

/** Draws a text overlay into a canvas using the same renderer as the export. */
export function TextLayer({ text, boxW, boxH, canvasH }: TextLayerProps) {
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
    drawText(ctx, text, { boxW: w, boxH: h, canvasH });
  }, [text, boxW, boxH, canvasH]);

  return <canvas ref={ref} className="block h-full w-full" />;
}
