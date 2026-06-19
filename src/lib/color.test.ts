import { describe, expect, it } from 'vitest';
import {
  channelGains,
  colorEquals,
  cssColorFilter,
  ffmpegColorFilter,
  gradeUniforms,
  hasExtraGrade,
  isNeutralColor,
  tonePoints,
} from '@/lib/color';
import { NEUTRAL_COLOR } from '@/types/editor';

describe('isNeutralColor', () => {
  it('treats undefined/null and the neutral preset as neutral', () => {
    expect(isNeutralColor(undefined)).toBe(true);
    expect(isNeutralColor(null)).toBe(true);
    expect(isNeutralColor(NEUTRAL_COLOR)).toBe(true);
  });

  it('detects any non-neutral channel', () => {
    expect(isNeutralColor({ ...NEUTRAL_COLOR, brightness: 1.2 })).toBe(false);
    expect(isNeutralColor({ ...NEUTRAL_COLOR, contrast: 0.8 })).toBe(false);
    expect(isNeutralColor({ ...NEUTRAL_COLOR, saturation: 0 })).toBe(false);
    expect(isNeutralColor({ ...NEUTRAL_COLOR, hue: 10 })).toBe(false);
  });
});

describe('cssColorFilter', () => {
  it('returns undefined when neutral', () => {
    expect(cssColorFilter(NEUTRAL_COLOR)).toBeUndefined();
    expect(cssColorFilter(undefined)).toBeUndefined();
  });

  it('builds a CSS filter string and omits hue when zero', () => {
    expect(cssColorFilter({ brightness: 1.1, contrast: 1.2, saturation: 0.5, hue: 0 })).toBe(
      'brightness(1.1) contrast(1.2) saturate(0.5)',
    );
    expect(cssColorFilter({ brightness: 1, contrast: 1, saturation: 1, hue: 30 })).toContain(
      'hue-rotate(30deg)',
    );
  });
});

describe('ffmpegColorFilter', () => {
  it('returns an empty string when neutral', () => {
    expect(ffmpegColorFilter(NEUTRAL_COLOR)).toBe('');
    expect(ffmpegColorFilter(undefined)).toBe('');
  });

  it('maps brightness to an additive offset, contrast/saturation straight through', () => {
    expect(ffmpegColorFilter({ brightness: 1.2, contrast: 1.1, saturation: 0.8, hue: 0 })).toBe(
      'eq=brightness=0.200:contrast=1.100:saturation=0.800',
    );
  });

  it('appends a hue rotation when set', () => {
    expect(ffmpegColorFilter({ brightness: 1, contrast: 1, saturation: 1, hue: 12 })).toBe(
      'eq=brightness=0.000:contrast=1.000:saturation=1.000,hue=h=12.00',
    );
  });
});

describe('colorEquals', () => {
  it('compares within epsilon and treats undefined as neutral', () => {
    expect(colorEquals(undefined, NEUTRAL_COLOR)).toBe(true);
    expect(colorEquals({ ...NEUTRAL_COLOR, brightness: 1.0001 }, NEUTRAL_COLOR)).toBe(true);
    expect(colorEquals({ ...NEUTRAL_COLOR, brightness: 1.2 }, NEUTRAL_COLOR)).toBe(false);
  });

  it('accounts for the deeper-grade fields', () => {
    expect(isNeutralColor({ ...NEUTRAL_COLOR, temperature: 20 })).toBe(false);
    expect(isNeutralColor({ ...NEUTRAL_COLOR, vignette: 30 })).toBe(false);
    expect(isNeutralColor({ ...NEUTRAL_COLOR, temperature: 0, sharpen: 0 })).toBe(true);
    expect(colorEquals({ ...NEUTRAL_COLOR, tint: 10 }, NEUTRAL_COLOR)).toBe(false);
    expect(colorEquals({ ...NEUTRAL_COLOR, exposure: 5 }, { ...NEUTRAL_COLOR, exposure: 5 })).toBe(true);
  });
});

describe('hasExtraGrade', () => {
  it('is false for absent or legacy-only grades, true once a deeper field engages', () => {
    expect(hasExtraGrade(undefined)).toBe(false);
    expect(hasExtraGrade({ brightness: 1.2, contrast: 1.3, saturation: 0.5, hue: 40 })).toBe(false);
    expect(hasExtraGrade({ ...NEUTRAL_COLOR, temperature: 1 })).toBe(true);
    expect(hasExtraGrade({ ...NEUTRAL_COLOR, sharpen: 50 })).toBe(true);
  });
});

describe('channelGains', () => {
  it('is identity when neutral', () => {
    const [r, g, b] = channelGains(NEUTRAL_COLOR);
    expect(r).toBeCloseTo(1);
    expect(g).toBeCloseTo(1);
    expect(b).toBeCloseTo(1);
  });

  it('warms (R up, B down) on positive temperature', () => {
    const [r, g, b] = channelGains({ ...NEUTRAL_COLOR, temperature: 100 });
    expect(r).toBeCloseTo(1.2);
    expect(g).toBeCloseTo(1);
    expect(b).toBeCloseTo(0.8);
  });

  it('scales every channel uniformly with exposure', () => {
    const [r, g, b] = channelGains({ ...NEUTRAL_COLOR, exposure: 100 });
    const expected = Math.pow(2, 1.5);
    expect(r).toBeCloseTo(expected);
    expect(g).toBeCloseTo(expected);
    expect(b).toBeCloseTo(expected);
  });
});

describe('tonePoints', () => {
  it('is the fixed 0.25/0.75 curve when neutral', () => {
    expect(tonePoints(NEUTRAL_COLOR)).toEqual({ low: 0.25, high: 0.75 });
  });

  it('lifts shadows and recovers highlights, clamped to 0..1', () => {
    expect(tonePoints({ ...NEUTRAL_COLOR, shadows: 100 }).low).toBeCloseTo(0.5);
    expect(tonePoints({ ...NEUTRAL_COLOR, highlights: -100 }).high).toBeCloseTo(0.5);
  });
});

describe('ffmpegColorFilter deeper grade', () => {
  it('emits no eq node when only deeper fields are set', () => {
    expect(ffmpegColorFilter({ ...NEUTRAL_COLOR, temperature: 100 })).toBe(
      'colorchannelmixer=rr=1.2000:gg=1.0000:bb=0.8000',
    );
  });

  it('maps highlights/shadows to a curves node', () => {
    expect(ffmpegColorFilter({ ...NEUTRAL_COLOR, shadows: 100 })).toBe(
      "curves=all='0/0 0.25/0.5000 0.5/0.5 0.75/0.7500 1/1'",
    );
  });

  it('maps vignette and sharpen to their filters', () => {
    expect(ffmpegColorFilter({ ...NEUTRAL_COLOR, vignette: 50 })).toBe('vignette=a=0.7000');
    expect(ffmpegColorFilter({ ...NEUTRAL_COLOR, sharpen: 100 })).toBe('unsharp=5:5:1.500:5:5:0');
  });

  it('appends deeper nodes after the legacy eq, in canonical order', () => {
    expect(ffmpegColorFilter({ brightness: 1.2, contrast: 1, saturation: 1, hue: 0, temperature: 100 })).toBe(
      'eq=brightness=0.200:contrast=1.000:saturation=1.000,colorchannelmixer=rr=1.2000:gg=1.0000:bb=0.8000',
    );
  });
});

describe('gradeUniforms', () => {
  it('returns identity uniforms for a neutral grade', () => {
    const u = gradeUniforms(undefined);
    expect(u.brightness).toBe(1);
    expect(u.gain).toEqual([1, 1, 1]);
    expect(u.toneLow).toBeCloseTo(0.25);
    expect(u.toneHigh).toBeCloseTo(0.75);
    expect(u.vignette).toBe(0);
    expect(u.sharpen).toBe(0);
  });

  it('converts hue to radians and scales sharpen/vignette to 0..max', () => {
    expect(gradeUniforms({ ...NEUTRAL_COLOR, hue: 180 }).hue).toBeCloseTo(Math.PI);
    expect(gradeUniforms({ ...NEUTRAL_COLOR, sharpen: 100 }).sharpen).toBeCloseTo(1.5);
    expect(gradeUniforms({ ...NEUTRAL_COLOR, vignette: 100 }).vignette).toBeCloseTo(1);
  });
});
