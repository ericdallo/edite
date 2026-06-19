import { describe, expect, it } from 'vitest';
import { colorEquals, cssColorFilter, ffmpegColorFilter, isNeutralColor } from '@/lib/color';
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
});
