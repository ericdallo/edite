import { describe, expect, it } from 'vitest';
import { slicePeaks } from '@/lib/media/waveform';

describe('slicePeaks', () => {
  const peaks = Array.from({ length: 100 }, (_, i) => i / 99); // 0..1 ramp

  it('returns the requested number of bars', () => {
    expect(slicePeaks(peaks, 0, 10, 10, 24)).toHaveLength(24);
  });

  it('samples the trimmed sub-range, not the whole media', () => {
    // The second half of a 10s media should start around the midpoint value.
    const bars = slicePeaks(peaks, 5, 10, 10, 8);
    expect(bars[0]).toBeGreaterThan(0.45);
    expect(bars[bars.length - 1]).toBeCloseTo(1, 1);
  });

  it('is empty for no peaks or zero bars', () => {
    expect(slicePeaks([], 0, 10, 10, 8)).toEqual([]);
    expect(slicePeaks(peaks, 0, 10, 10, 0)).toEqual([]);
  });

  it('handles a zero-length media without throwing', () => {
    expect(() => slicePeaks(peaks, 0, 0, 0, 8)).not.toThrow();
  });
});
