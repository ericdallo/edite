import { describe, expect, it } from 'vitest';
import { canvasSize, resolveAspectRatio } from '@/types/editor';
import { makeMedia } from '@/test/factories';

describe('resolveAspectRatio', () => {
  it('returns the preset ratio for fixed aspects', () => {
    expect(resolveAspectRatio('16:9', [])).toBeCloseTo(16 / 9);
    expect(resolveAspectRatio('1:1', [])).toBe(1);
  });

  it("uses the first video's native ratio for 'original'", () => {
    const media = [
      makeMedia({ kind: 'image', width: 100, height: 100 }),
      makeMedia({ kind: 'video', width: 1080, height: 1920 }),
    ];
    expect(resolveAspectRatio('original', media)).toBeCloseTo(1080 / 1920);
  });

  it('falls back to an image when there is no video', () => {
    expect(resolveAspectRatio('original', [makeMedia({ kind: 'image', width: 400, height: 300 })])).toBeCloseTo(4 / 3);
  });

  it('falls back to 16:9 when there is no usable media', () => {
    expect(resolveAspectRatio('original', [])).toBeCloseTo(16 / 9);
    expect(resolveAspectRatio('original', [makeMedia({ kind: 'video', width: 0, height: 0 })])).toBeCloseTo(16 / 9);
  });
});

describe('canvasSize', () => {
  it('keeps the short side at the requested resolution with even dims', () => {
    const landscape = canvasSize(16 / 9, 720);
    expect(landscape.height).toBe(720);
    expect(landscape.width).toBe(1280);

    const portrait = canvasSize(9 / 16, 720);
    expect(portrait.width).toBe(720);
    expect(portrait.height % 2).toBe(0);
    expect(portrait.height).toBeGreaterThan(portrait.width);
  });
});
