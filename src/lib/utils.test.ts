import { describe, expect, it } from 'vitest';
import { clamp, formatBytes, formatClock, formatTime } from '@/lib/utils';

describe('formatTime', () => {
  it('formats mm:ss.cc', () => {
    expect(formatTime(0)).toBe('00:00.00');
    expect(formatTime(65.5)).toBe('01:05.50');
  });

  it('treats negative and non-finite input as zero', () => {
    expect(formatTime(-5)).toBe('00:00.00');
    expect(formatTime(NaN)).toBe('00:00.00');
  });
});

describe('formatClock', () => {
  it('formats m:ss without leading-zero minutes', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(605)).toBe('10:05');
  });
});

describe('formatBytes', () => {
  it('scales to the largest fitting unit', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });
});

describe('clamp', () => {
  it('keeps values inside the range', () => {
    expect(clamp(2, 0, 3)).toBe(2);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
