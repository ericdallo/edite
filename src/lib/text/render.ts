import type { TextStyle } from '@/types/editor';

/** The 2D-context subset needed to measure/lay out text (keeps wrapping unit-testable). */
export interface TextMetricsCtx {
  font: string;
  measureText: (s: string) => { width: number };
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** CSS/canvas font shorthand, e.g. `italic 700 48px Georgia, serif`. */
export function fontString(
  style: Pick<TextStyle, 'italic' | 'fontWeight' | 'fontFamily'>,
  fontPx: number,
): string {
  const parts: string[] = [];
  if (style.italic) parts.push('italic');
  parts.push(String(style.fontWeight || 400));
  parts.push(`${fontPx}px`);
  parts.push(style.fontFamily);
  return parts.join(' ');
}

/**
 * Break text into display lines: honor explicit newlines, then word-wrap each
 * paragraph to `maxWidth`. A single word wider than the box is left to overflow
 * on its own line (matching the browser's default `word-break: normal`). `ctx`
 * must already have its `font` set so measurements match the final render.
 */
export function wrapText(ctx: TextMetricsCtx, content: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of content.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export interface DrawBox {
  /** text box width in px */
  boxW: number;
  /** text box height in px */
  boxH: number;
  /** full output canvas height in px (font size scales off this) */
  canvasH: number;
}

/**
 * Draw a text overlay into `ctx` (whose canvas is `boxW`×`boxH`). The same
 * function feeds the live preview and the export rasterizer, so they match
 * exactly. Text is vertically centered and clipped to the box.
 */
export function drawText(ctx: CanvasRenderingContext2D, style: TextStyle, box: DrawBox): void {
  const { boxW, boxH, canvasH } = box;
  ctx.clearRect(0, 0, boxW, boxH);

  if (style.background) {
    ctx.save();
    ctx.globalAlpha = clamp01(style.backgroundOpacity);
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, boxW, boxH);
    ctx.restore();
  }

  const fontPx = Math.max(1, style.fontSize * canvasH);
  const pad = fontPx * 0.28;
  ctx.font = fontString(style, fontPx);
  ctx.textBaseline = 'top';

  const lineHeight = fontPx * (style.lineHeight || 1.2);
  const maxWidth = Math.max(1, boxW - pad * 2);
  const lines = wrapText(ctx, style.content, maxWidth);
  const totalH = lines.length * lineHeight;
  let y = Math.max(pad, (boxH - totalH) / 2);

  const strokeWidth = style.strokeWidth ?? 0;
  const hasStroke = strokeWidth > 0;
  const setShadow = (on: boolean) => {
    ctx.shadowColor = on ? 'rgba(0,0,0,0.55)' : 'transparent';
    ctx.shadowBlur = on ? fontPx * 0.14 : 0;
    ctx.shadowOffsetY = on ? fontPx * 0.06 : 0;
  };

  ctx.save();
  ctx.fillStyle = style.color;
  if (hasStroke) {
    // Stroke is centred on the glyph path, so double the width and draw it
    // before the fill: the fill covers the inner half, leaving a clean outline.
    ctx.lineWidth = Math.max(1, fontPx * strokeWidth * 2);
    ctx.strokeStyle = style.strokeColor || '#000000';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
  }
  for (const line of lines) {
    const w = ctx.measureText(line).width;
    const x = style.align === 'center' ? (boxW - w) / 2 : style.align === 'right' ? boxW - pad - w : pad;
    // The drop shadow sits under the outermost pass (the outline when present,
    // otherwise the fill) so it isn't doubled.
    if (hasStroke) {
      setShadow(style.shadow);
      ctx.strokeText(line, x, y);
      setShadow(false);
      ctx.fillText(line, x, y);
    } else {
      setShadow(style.shadow);
      ctx.fillText(line, x, y);
    }
    y += lineHeight;
  }
  ctx.restore();
}
