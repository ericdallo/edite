import { describe, expect, it } from 'vitest';
import { multiThreadAvailable } from '@/lib/ffmpeg/core-select';

describe('multiThreadAvailable', () => {
  it('requires both cross-origin isolation and SharedArrayBuffer', () => {
    const SAB = function () {};
    expect(multiThreadAvailable({ crossOriginIsolated: true, SharedArrayBuffer: SAB })).toBe(true);
    expect(multiThreadAvailable({ crossOriginIsolated: false, SharedArrayBuffer: SAB })).toBe(false);
    expect(multiThreadAvailable({ crossOriginIsolated: true })).toBe(false);
    expect(multiThreadAvailable({})).toBe(false);
  });
});
