import { describe, expect, it } from 'vitest';
import { clampCrop, cropMediaStyle } from '@/lib/crop';
import { FULL_RECT } from '@/types/editor';

describe('clampCrop', () => {
  it('returns undefined for a full (uncropped) rect', () => {
    expect(clampCrop(FULL_RECT)).toBeUndefined();
    expect(clampCrop({ x: 0, y: 0, w: 1, h: 1 })).toBeUndefined();
  });

  it('clamps a sub-rect into the frame and keeps width within bounds', () => {
    expect(clampCrop({ x: 0.2, y: 0.1, w: 0.5, h: 0.4 })).toEqual({ x: 0.2, y: 0.1, w: 0.5, h: 0.4 });
    // x + w can't exceed 1
    const c = clampCrop({ x: 0.8, y: 0, w: 0.5, h: 1 });
    expect(c?.x).toBe(0.8);
    expect(c?.w).toBeCloseTo(0.2, 5);
  });
});

describe('cropMediaStyle', () => {
  it('is undefined when there is no crop or the sizes are unmeasured', () => {
    expect(cropMediaStyle(undefined, 400, 300, 800, 600)).toBeUndefined();
    expect(cropMediaStyle(FULL_RECT, 400, 300, 800, 600)).toBeUndefined();
    expect(cropMediaStyle({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 0, 300, 800, 600)).toBeUndefined();
  });

  it('scales and offsets the media so the kept region cover-fills the box', () => {
    const s = cropMediaStyle({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 400, 300, 800, 600);
    expect(s).toMatchObject({
      position: 'absolute',
      left: '-200px',
      top: '-150px',
      width: '800px',
      height: '600px',
      transformOrigin: '400px 300px',
    });
    expect(String(s?.transform)).toContain('rotate(0deg)');
  });

  it('folds flips into the transform', () => {
    const s = cropMediaStyle({ x: 0, y: 0, w: 0.5, h: 0.5 }, 400, 300, 800, 600, 0, true, false);
    expect(String(s?.transform)).toContain('scaleX(-1)');
  });
});
