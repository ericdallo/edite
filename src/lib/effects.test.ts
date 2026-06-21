import { describe, expect, it } from 'vitest';
import {
  clampEffects,
  cssEffectsFilter,
  effectsEqual,
  effectUniforms,
  ffmpegEffectsFilter,
  hasShaderEffects,
  isNeutralEffects,
} from '@/lib/effects';

describe('isNeutralEffects', () => {
  it('treats absent / empty / all-zero sets as neutral', () => {
    expect(isNeutralEffects(undefined)).toBe(true);
    expect(isNeutralEffects(null)).toBe(true);
    expect(isNeutralEffects({})).toBe(true);
    expect(isNeutralEffects({ blur: 0, pixelate: 0, rgbSplit: 0, grain: 0 })).toBe(true);
  });

  it('detects any engaged effect', () => {
    expect(isNeutralEffects({ blur: 5 })).toBe(false);
    expect(isNeutralEffects({ pixelate: 5 })).toBe(false);
    expect(isNeutralEffects({ rgbSplit: 5 })).toBe(false);
    expect(isNeutralEffects({ grain: 5 })).toBe(false);
  });
});

describe('hasShaderEffects', () => {
  it('is true only for the shader-rendered effects (not blur)', () => {
    expect(hasShaderEffects({ blur: 80 })).toBe(false);
    expect(hasShaderEffects({ pixelate: 1 })).toBe(true);
    expect(hasShaderEffects({ rgbSplit: 1 })).toBe(true);
    expect(hasShaderEffects({ grain: 1 })).toBe(true);
    expect(hasShaderEffects(undefined)).toBe(false);
  });
});

describe('clampEffects', () => {
  it('clamps each amount to 0..100 and keeps only present fields', () => {
    expect(clampEffects({ blur: 150, grain: -10 })).toEqual({ blur: 100, grain: 0 });
    expect(clampEffects({ pixelate: 42 })).toEqual({ pixelate: 42 });
    expect(clampEffects({})).toEqual({});
  });
});

describe('effectsEqual', () => {
  it('compares with absent treated as zero', () => {
    expect(effectsEqual(undefined, {})).toBe(true);
    expect(effectsEqual({ blur: 0 }, undefined)).toBe(true);
    expect(effectsEqual({ blur: 10 }, { blur: 10 })).toBe(true);
    expect(effectsEqual({ blur: 10 }, { blur: 11 })).toBe(false);
  });
});

describe('cssEffectsFilter', () => {
  it('returns undefined when blur is off or the frame is unmeasured', () => {
    expect(cssEffectsFilter({}, 200)).toBeUndefined();
    expect(cssEffectsFilter({ blur: 50 }, 0)).toBeUndefined();
    // The other effects are shader/ffmpeg only, never CSS.
    expect(cssEffectsFilter({ pixelate: 100, grain: 100 }, 200)).toBeUndefined();
  });

  it('scales the blur radius as a fraction of the frame min dimension', () => {
    // 50/100 * 0.04 * 200 = 4
    expect(cssEffectsFilter({ blur: 50 }, 200)).toBe('blur(4.00px)');
  });
});

describe('ffmpegEffectsFilter', () => {
  it('is empty when neutral', () => {
    expect(ffmpegEffectsFilter(undefined, 1000, 1000)).toBe('');
    expect(ffmpegEffectsFilter({}, 1000, 1000)).toBe('');
  });

  it('emits the matched nodes in canonical order (pixelate, split, grain, blur)', () => {
    expect(ffmpegEffectsFilter({ blur: 100, pixelate: 100, rgbSplit: 100, grain: 100 }, 1000, 1000)).toBe(
      'pixelize=w=120:h=120,rgbashift=rh=20:bh=-20,noise=alls=60:allf=t+u,gblur=sigma=40.00',
    );
  });

  it('sizes block/shift/blur off the clip frame', () => {
    expect(ffmpegEffectsFilter({ pixelate: 50 }, 800, 400)).toBe('pixelize=w=24:h=24');
    expect(ffmpegEffectsFilter({ rgbSplit: 50 }, 800, 400)).toBe('rgbashift=rh=8:bh=-8');
    expect(ffmpegEffectsFilter({ blur: 25 }, 800, 400)).toBe('gblur=sigma=4.00');
  });

  it('never emits a degenerate (zero) block or shift', () => {
    expect(ffmpegEffectsFilter({ pixelate: 0.5 }, 10, 10)).toBe('pixelize=w=2:h=2');
    expect(ffmpegEffectsFilter({ rgbSplit: 0.5 }, 10, 10)).toBe('rgbashift=rh=1:bh=-1');
  });
});

describe('effectUniforms', () => {
  it('maps amounts to shader-ready values (blur excluded)', () => {
    expect(effectUniforms({ pixelate: 100, rgbSplit: 100, grain: 100 })).toEqual({
      pixelate: 1,
      rgbSplit: 0.02,
      grain: 0.4,
    });
    expect(effectUniforms(undefined)).toEqual({ pixelate: 0, rgbSplit: 0, grain: 0 });
  });
});
