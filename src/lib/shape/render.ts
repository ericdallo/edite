import type { ShapeStyle } from '@/types/editor';

export interface ShapeDims {
  boxW: number;
  boxH: number;
}

type Pt = [number, number];

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function polygon(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
}

function starPoints(cx: number, cy: number, outer: number, inner: number, points: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function arrowPoints(boxW: number, boxH: number, inset: number): Pt[] {
  const left = inset;
  const right = boxW - inset;
  const top = inset;
  const bottom = boxH - inset;
  const cy = boxH / 2;
  const headW = (right - left) * 0.42;
  const shaftRight = right - headW;
  const shaftHalf = (bottom - top) * 0.16;
  return [
    [left, cy - shaftHalf],
    [shaftRight, cy - shaftHalf],
    [shaftRight, top],
    [right, cy],
    [shaftRight, bottom],
    [shaftRight, cy + shaftHalf],
    [left, cy + shaftHalf],
  ];
}

/**
 * Draw a vector shape into a 2D context sized to its box. The same function runs
 * in the preview canvas and the export rasterizer, so a shape renders pixel for
 * pixel the same in both. Strokes are inset so the outline stays inside the box.
 */
export function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeStyle, { boxW, boxH }: ShapeDims): void {
  const short = Math.min(boxW, boxH);
  const sw = Math.max(0, shape.strokeWidth) * short;
  const inset = sw / 2;
  const w = boxW - sw;
  const h = boxH - sw;
  const cx = boxW / 2;
  const cy = boxH / 2;

  ctx.clearRect(0, 0, boxW, boxH);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (shape.kind) {
    case 'rectangle':
      roundRectPath(ctx, inset, inset, w, h, shape.radius * short);
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      polygon(ctx, [
        [cx, inset],
        [boxW - inset, boxH - inset],
        [inset, boxH - inset],
      ]);
      break;
    case 'diamond':
      polygon(ctx, [
        [cx, inset],
        [boxW - inset, cy],
        [cx, boxH - inset],
        [inset, cy],
      ]);
      break;
    case 'star': {
      const outer = (short - sw) / 2;
      polygon(ctx, starPoints(cx, cy, outer, outer * 0.42, 5));
      break;
    }
    case 'arrow':
      polygon(ctx, arrowPoints(boxW, boxH, inset));
      break;
  }

  if (shape.fill && shape.fill !== 'none') {
    ctx.fillStyle = shape.fill;
    ctx.fill();
  }
  if (sw > 0) {
    ctx.strokeStyle = shape.stroke;
    ctx.lineWidth = sw;
    ctx.stroke();
  }
}
