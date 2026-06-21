import { describe, expect, it } from 'vitest';
import { clampMask, isNeutralMask, maskAlphaExpr, maskCssStyle, maskEquals } from '@/lib/mask';
import { DEFAULT_MASK, type ClipMask } from '@/types/editor';

const circle = (over: Partial<ClipMask> = {}): ClipMask => ({ ...DEFAULT_MASK, ...over });

describe('isNeutralMask', () => {
  it('is neutral only when absent', () => {
    expect(isNeutralMask(undefined)).toBe(true);
    expect(isNeutralMask(null)).toBe(true);
    expect(isNeutralMask(DEFAULT_MASK)).toBe(false);
  });
});

describe('clampMask', () => {
  it('clamps geometry into range and wraps the angle', () => {
    expect(clampMask({ shape: 'circle', x: 2, y: -1, size: 5, angle: 400, feather: 200, invert: true })).toEqual({
      shape: 'circle',
      x: 1,
      y: 0,
      size: 1,
      angle: 40,
      feather: 100,
      invert: true,
    });
  });
});

describe('maskEquals', () => {
  it('compares masks, treating absent as no mask', () => {
    expect(maskEquals(undefined, undefined)).toBe(true);
    expect(maskEquals(DEFAULT_MASK, undefined)).toBe(false);
    expect(maskEquals(circle(), circle())).toBe(true);
    expect(maskEquals(circle(), circle({ size: 0.5 }))).toBe(false);
  });
});

describe('maskAlphaExpr', () => {
  it('builds a true-circle distance ramp', () => {
    const e = maskAlphaExpr(circle({ shape: 'circle', x: 0.5, y: 0.5, size: 0.4 }));
    expect(e).toContain('hypot(X-0.50000*W,Y-0.50000*H)');
    expect(e).toContain('min(W,H)');
  });

  it('builds a product of two feathered bands for a rectangle', () => {
    const e = maskAlphaExpr(circle({ shape: 'rectangle' }));
    expect(e).toContain('clip((X/W-');
    expect(e).toContain('clip((Y/H-');
    expect((e.match(/clip\(/g) ?? []).length).toBe(4);
  });

  it('builds a signed-distance ramp for a linear edge', () => {
    const e = maskAlphaExpr(circle({ shape: 'linear', angle: 0 }));
    expect(e).toContain('clip(0.5-((X-');
    expect(e).toContain('hypot(W,H)');
  });

  it('wraps the expression in 1- when inverted', () => {
    expect(maskAlphaExpr(circle({ invert: true })).startsWith('(1-(')).toBe(true);
    expect(maskAlphaExpr(circle({ invert: false })).startsWith('(1-(')).toBe(false);
  });
});

describe('maskCssStyle', () => {
  it('uses a radial gradient for a circle', () => {
    const s = maskCssStyle(circle({ shape: 'circle' }), 400, 300);
    expect(String(s.maskImage)).toContain('radial-gradient(circle');
    expect(s.WebkitMaskImage).toBe(s.maskImage);
  });

  it('intersects two gradients for a rectangle, adds four when inverted', () => {
    expect(maskCssStyle(circle({ shape: 'rectangle', invert: false }), 400, 300).maskComposite).toBe('intersect');
    expect(maskCssStyle(circle({ shape: 'rectangle', invert: true }), 400, 300).maskComposite).toBe('add');
  });

  it('uses a single linear gradient for a linear edge', () => {
    const s = maskCssStyle(circle({ shape: 'linear' }), 400, 300);
    expect(String(s.maskImage)).toContain('linear-gradient(');
  });
});
