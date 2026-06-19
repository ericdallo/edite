import { describe, expect, it } from 'vitest';
import { ffmpegChromaFilter, hexToRgb01 } from '@/lib/chroma';
import { DEFAULT_CHROMA } from '@/types/editor';

describe('hexToRgb01', () => {
  it('parses #rrggbb into 0..1 components', () => {
    expect(hexToRgb01('#00ff00')).toEqual([0, 1, 0]);
    expect(hexToRgb01('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToRgb01('000000')).toEqual([0, 0, 0]);
  });

  it('falls back to green for invalid input', () => {
    expect(hexToRgb01('nope')).toEqual([0, 1, 0]);
    expect(hexToRgb01('')).toEqual([0, 1, 0]);
  });
});

describe('ffmpegChromaFilter', () => {
  it('returns an empty string when absent', () => {
    expect(ffmpegChromaFilter(undefined)).toBe('');
    expect(ffmpegChromaFilter(null)).toBe('');
  });

  it('builds a chromakey filter with a 0xRRGGBB color', () => {
    expect(ffmpegChromaFilter(DEFAULT_CHROMA)).toBe('chromakey=0x00ff00:0.300:0.100');
    expect(ffmpegChromaFilter({ color: '#0047FF', similarity: 0.5, blend: 0.2 })).toBe(
      'chromakey=0x0047ff:0.500:0.200',
    );
  });

  it('clamps similarity to the ffmpeg minimum and blend to 0..1', () => {
    expect(ffmpegChromaFilter({ color: '#00ff00', similarity: 0, blend: 2 })).toBe(
      'chromakey=0x00ff00:0.010:1.000',
    );
  });
});
