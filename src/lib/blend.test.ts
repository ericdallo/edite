import { describe, expect, it } from 'vitest';
import { cssBlendMode, ffmpegBlendMode } from '@/lib/blend';

describe('blend mode maps', () => {
  it('spells soft light per target and passes the rest through', () => {
    expect(cssBlendMode('softlight')).toBe('soft-light');
    expect(ffmpegBlendMode('softlight')).toBe('softlight');
    expect(cssBlendMode('screen')).toBe('screen');
    expect(ffmpegBlendMode('multiply')).toBe('multiply');
  });
});
