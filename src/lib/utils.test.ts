import { describe, expect, it } from 'vitest';
import { clamp, formatBytes, formatClock, formatRelativeTime, formatTime } from '@/lib/utils';

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

describe('formatRelativeTime', () => {
  const now = 1_700_000_000_000;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;

  it('uses coarse relative buckets', () => {
    expect(formatRelativeTime(now, now)).toBe('just now');
    expect(formatRelativeTime(now - 30_000, now)).toBe('just now');
    expect(formatRelativeTime(now - 5 * min, now)).toBe('5m ago');
    expect(formatRelativeTime(now - 3 * hr, now)).toBe('3h ago');
    expect(formatRelativeTime(now - 2 * day, now)).toBe('2d ago');
  });

  it('falls back to a date past a week and treats the future as now', () => {
    expect(formatRelativeTime(now - 30 * day, now)).not.toMatch(/ago|just now/);
    expect(formatRelativeTime(now + day, now)).toBe('just now');
  });
});
