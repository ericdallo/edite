import { describe, expect, it } from 'vitest';
import type { ShapeStyle } from '@/types/editor';
import { drawShape } from '@/lib/shape/render';

/** A canvas 2D context stub that records which path/paint methods were called. */
function mockCtx() {
  const calls: string[] = [];
  const rec =
    (fn: string) =>
    (..._args: unknown[]) =>
      calls.push(fn);
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    lineCap: '',
    clearRect: rec('clearRect'),
    beginPath: rec('beginPath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    arcTo: rec('arcTo'),
    ellipse: rec('ellipse'),
    closePath: rec('closePath'),
    fill: rec('fill'),
    stroke: rec('stroke'),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const style = (over: Partial<ShapeStyle>): ShapeStyle => ({
  kind: 'rectangle',
  fill: '#8b5cf6',
  stroke: '#ffffff',
  strokeWidth: 0,
  radius: 0.1,
  ...over,
});

describe('drawShape', () => {
  it('fills a shape, but not when the fill is none', () => {
    const a = mockCtx();
    drawShape(a.ctx, style({ fill: '#ffffff' }), { boxW: 100, boxH: 100 });
    expect(a.calls).toContain('fill');

    const b = mockCtx();
    drawShape(b.ctx, style({ fill: 'none' }), { boxW: 100, boxH: 100 });
    expect(b.calls).not.toContain('fill');
  });

  it('strokes only when the outline width is positive', () => {
    const a = mockCtx();
    drawShape(a.ctx, style({ strokeWidth: 0 }), { boxW: 100, boxH: 100 });
    expect(a.calls).not.toContain('stroke');

    const b = mockCtx();
    drawShape(b.ctx, style({ strokeWidth: 0.05 }), { boxW: 100, boxH: 100 });
    expect(b.calls).toContain('stroke');
  });

  it('uses an ellipse path for the ellipse kind', () => {
    const a = mockCtx();
    drawShape(a.ctx, style({ kind: 'ellipse' }), { boxW: 100, boxH: 100 });
    expect(a.calls).toContain('ellipse');
  });

  it('builds a triangle from three points', () => {
    const a = mockCtx();
    drawShape(a.ctx, style({ kind: 'triangle' }), { boxW: 100, boxH: 100 });
    expect(a.calls.filter((c) => c === 'lineTo')).toHaveLength(2); // moveTo + 2 lineTo + closePath
    expect(a.calls).toContain('closePath');
  });
});
