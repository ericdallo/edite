import { useEffect, useRef } from 'react';
import type { TextStyle } from '@/types/editor';
import { drawText, type TextHighlight } from '@/lib/text/render';

export interface TextLayerProps {
  text: TextStyle;
  /** text box size in CSS px */
  boxW: number;
  boxH: number;
  /** full preview canvas height in CSS px (font size scales off this) */
  canvasH: number;
  /** karaoke word highlight at the current time (caption clips only). */
  highlight?: TextHighlight | null;
}

/** Draws a text overlay into a canvas using the same renderer as the export. */
export function TextLayer({ text, boxW, boxH, canvasH, highlight }: TextLayerProps) {
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
    const paint = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawText(ctx, text, { boxW: w, boxH: h, canvasH }, highlight);
    };
    paint();
    // Repaint once fonts finish loading so a freshly imported or restored custom
    // font isn't left drawn in a fallback face.
    let canceled = false;
    document.fonts?.ready
      .then(() => {
        if (!canceled) paint();
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
    };
  }, [text, boxW, boxH, canvasH, highlight?.count, highlight?.color]);

  return <canvas ref={ref} className="block h-full w-full" />;
}
