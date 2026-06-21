import { describe, expect, it } from 'vitest';
import { keyframeExport, pwLinearExpr } from '@/lib/ffmpeg/keyframes';
import { FULL_RECT } from '@/types/editor';

describe('pwLinearExpr', () => {
  it('is a constant for a single point', () => {
    expect(pwLinearExpr([{ t: 0, v: 5 }])).toBe('5');
  });

  it('uses a custom time variable when asked (geq uses uppercase T)', () => {
    expect(pwLinearExpr([{ t: 0, v: 1 }, { t: 2, v: 0 }], 'T')).toBe(
      'if(lt(T,0),1,if(lt(T,2),(1+(-1)*(T-0)/2),0))',
    );
  });

  it('builds a clamped linear ramp between two points', () => {
    expect(pwLinearExpr([{ t: 0, v: 0 }, { t: 2, v: 100 }])).toBe(
      'if(lt(t,0),0,if(lt(t,2),(0+(100)*(t-0)/2),100))',
    );
  });

  it('nests multiple segments and clamps both ends', () => {
    const expr = pwLinearExpr([{ t: 1, v: 10 }, { t: 3, v: 20 }, { t: 5, v: 20 }]);
    // clamps to 10 before t=1 and to the final 20 after t=5
    expect(expr.startsWith('if(lt(t,1),10,')).toBe(true);
    expect(expr.endsWith(',20)))')).toBe(true);
    expect(expr).toContain('if(lt(t,3),');
    expect(expr).toContain('if(lt(t,5),');
  });
});

describe('keyframeExport', () => {
  it('uses the largest keyframe for the cover size and offsets points by clipStart', () => {
    const kf = keyframeExport(
      [
        { at: 0, rect: { x: 0, y: 0, w: 1, h: 1 } },
        { at: 4, rect: { x: 0.5, y: 0.25, w: 0.5, h: 0.5 } },
      ],
      100,
      100,
      2,
    );
    expect(kf.refW).toBe(100);
    expect(kf.refH).toBe(100);
    // x ramps 0 -> 50 (px) over timeline t in [2, 6]
    expect(kf.x).toBe('if(lt(t,2),0,if(lt(t,6),(0+(50)*(t-2)/4),50))');
    // w shrinks 100 -> 50 (px)
    expect(kf.w).toBe('if(lt(t,2),100,if(lt(t,6),(100+(-50)*(t-2)/4),50))');
  });

  it('sorts keyframes by time before building', () => {
    const kf = keyframeExport(
      [
        { at: 4, rect: { x: 0.5, y: 0, w: 1, h: 1 } },
        { at: 0, rect: { x: 0, y: 0, w: 1, h: 1 } },
      ],
      100,
      100,
      0,
    );
    expect(kf.x).toBe('if(lt(t,0),0,if(lt(t,4),(0+(50)*(t-0)/4),50))');
  });

  it('emits an opacity T-expression only when a keyframe pins opacity', () => {
    const animated = keyframeExport(
      [
        { at: 0, rect: FULL_RECT, opacity: 1 },
        { at: 2, rect: FULL_RECT, opacity: 0 },
      ],
      1920,
      1080,
      0,
      1,
    );
    expect(animated.opacity).toContain('lt(T,');
    const plain = keyframeExport([{ at: 0, rect: FULL_RECT }, { at: 2, rect: FULL_RECT }], 1920, 1080, 0, 1);
    expect(plain.opacity).toBeUndefined();
  });
});
