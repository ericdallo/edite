import { describe, expect, it } from 'vitest';
import {
  audioFadeGain,
  canMergeClips,
  clipEnd,
  clipSnapTargets,
  clipSourceAt,
  clipTimelineDuration,
  isClipActiveAt,
  projectDuration,
  snapStart,
} from '@/lib/timeline';
import { makeClip } from '@/test/factories';

describe('audioFadeGain', () => {
  it('is 1 with no fades', () => {
    expect(audioFadeGain(makeClip({ start: 0, in: 0, out: 10 }), 5)).toBe(1);
  });

  it('ramps up linearly across the fade-in', () => {
    const c = makeClip({ start: 0, in: 0, out: 10, fadeIn: 2 });
    expect(audioFadeGain(c, 0)).toBe(0);
    expect(audioFadeGain(c, 1)).toBeCloseTo(0.5, 5);
    expect(audioFadeGain(c, 2)).toBe(1);
  });

  it('ramps down linearly across the fade-out', () => {
    const c = makeClip({ start: 0, in: 0, out: 10, fadeOut: 2 });
    expect(audioFadeGain(c, 8)).toBe(1);
    expect(audioFadeGain(c, 9)).toBeCloseTo(0.5, 5);
    expect(audioFadeGain(c, 10)).toBe(0);
  });

  it('respects the clip start offset', () => {
    const c = makeClip({ start: 4, in: 0, out: 10, fadeIn: 2 });
    expect(audioFadeGain(c, 4)).toBe(0);
    expect(audioFadeGain(c, 5)).toBeCloseTo(0.5, 5);
  });
});

describe('clipTimelineDuration', () => {
  it('is (out - in) at 1x speed', () => {
    expect(clipTimelineDuration(makeClip({ in: 2, out: 8 }))).toBe(6);
  });

  it('shrinks with higher speed and grows with lower speed', () => {
    expect(clipTimelineDuration(makeClip({ in: 0, out: 8, speed: 2 }))).toBe(4);
    expect(clipTimelineDuration(makeClip({ in: 0, out: 8, speed: 0.5 }))).toBe(16);
  });

  it('never goes negative', () => {
    expect(clipTimelineDuration(makeClip({ in: 5, out: 5 }))).toBe(0);
  });
});

describe('clipEnd', () => {
  it('is start + timeline duration', () => {
    expect(clipEnd(makeClip({ start: 3, in: 0, out: 4, speed: 2 }))).toBe(5);
  });
});

describe('projectDuration', () => {
  it('is the latest clip end', () => {
    const clips = [
      makeClip({ start: 0, in: 0, out: 4 }),
      makeClip({ start: 10, in: 0, out: 3 }),
      makeClip({ start: 2, in: 0, out: 2 }),
    ];
    expect(projectDuration(clips)).toBe(13);
  });

  it('is 0 for an empty timeline', () => {
    expect(projectDuration([])).toBe(0);
  });
});

describe('clipSourceAt', () => {
  it('maps a timeline time to source time accounting for speed', () => {
    const clip = makeClip({ start: 2, in: 1, out: 9, speed: 2 });
    expect(clipSourceAt(clip, 4)).toBe(5); // in + (4-2)*2
  });

  it('clamps to the trimmed [in, out] range', () => {
    const clip = makeClip({ start: 0, in: 1, out: 5, speed: 1 });
    expect(clipSourceAt(clip, -10)).toBe(1);
    expect(clipSourceAt(clip, 100)).toBe(5);
  });
});

describe('clipSourceAt with a freeze frame', () => {
  // A held still of source time 3.5, placed at timeline 2 for a 2s hold.
  const frozen = makeClip({ start: 2, in: 0, out: 2, speed: 1, freeze: 3.5 });

  it('returns the held frame for any time in the clip', () => {
    expect(clipSourceAt(frozen, 2)).toBe(3.5);
    expect(clipSourceAt(frozen, 3)).toBe(3.5);
    expect(clipSourceAt(frozen, 3.99)).toBe(3.5);
  });

  it('keeps a plain hold window as its timeline duration', () => {
    expect(clipTimelineDuration(frozen)).toBe(2);
  });
});

describe('isClipActiveAt', () => {
  const clip = makeClip({ start: 2, in: 0, out: 4, speed: 1 }); // active [2,6)

  it('is true within the span', () => {
    expect(isClipActiveAt(clip, 3)).toBe(true);
  });

  it('is false before the start and at/after the end', () => {
    expect(isClipActiveAt(clip, 1)).toBe(false);
    expect(isClipActiveAt(clip, 6)).toBe(false);
  });

  it('is never active when hidden', () => {
    expect(isClipActiveAt(makeClip({ ...clip, hidden: true }), 3)).toBe(false);
  });
});

describe('clipSnapTargets', () => {
  it('includes 0, the playhead and every other clip edge but not the excluded clip', () => {
    const a = makeClip({ id: 'a', start: 0, in: 0, out: 4 }); // edges 0, 4
    const b = makeClip({ id: 'b', start: 5, in: 0, out: 3 }); // edges 5, 8
    const targets = clipSnapTargets([a, b], 'a', 7);
    expect(targets).toContain(0);
    expect(targets).toContain(7); // playhead
    expect(targets).toContain(5);
    expect(targets).toContain(8);
    expect(targets).not.toContain(4); // edge of the excluded clip
  });
});

describe('canMergeClips', () => {
  // A 0..10 clip split at t=4 yields these two abutting halves.
  const left = makeClip({ id: 'l', mediaId: 'm1', trackId: 't1', start: 0, in: 0, out: 4 });
  const right = makeClip({ id: 'r', mediaId: 'm1', trackId: 't1', start: 4, in: 4, out: 10 });

  it('accepts adjacent same-source halves (the inverse of a split)', () => {
    expect(canMergeClips([left, right])).toBe(true);
    expect(canMergeClips([right, left])).toBe(true); // order independent
  });

  it('accepts a run of three contiguous clips', () => {
    const a = makeClip({ id: 'a', mediaId: 'm1', trackId: 't1', start: 0, in: 0, out: 3 });
    const b = makeClip({ id: 'b', mediaId: 'm1', trackId: 't1', start: 3, in: 3, out: 6 });
    const c = makeClip({ id: 'c', mediaId: 'm1', trackId: 't1', start: 6, in: 6, out: 9 });
    expect(canMergeClips([a, b, c])).toBe(true);
  });

  it('rejects a single clip', () => {
    expect(canMergeClips([left])).toBe(false);
  });

  it('rejects different media or tracks', () => {
    expect(canMergeClips([left, { ...right, mediaId: 'm2' }])).toBe(false);
    expect(canMergeClips([left, { ...right, trackId: 't2' }])).toBe(false);
  });

  it('rejects a gap or overlap on the timeline', () => {
    expect(canMergeClips([left, { ...right, start: 5 }])).toBe(false); // gap
    expect(canMergeClips([left, { ...right, start: 3 }])).toBe(false); // overlap
  });

  it('rejects a discontinuity in the source range', () => {
    expect(canMergeClips([left, { ...right, in: 5 }])).toBe(false);
  });

  it('rejects text overlays (no source to join)', () => {
    const t1 = makeClip({ id: 't1c', mediaId: '', start: 0, in: 0, out: 3, text: undefined });
    const t2 = makeClip({ id: 't2c', mediaId: '', start: 3, in: 3, out: 6 });
    expect(canMergeClips([t1, t2])).toBe(false);
  });
});

describe('snapStart', () => {
  const targets = [0, 5, 10];

  it('snaps the leading edge to a near target', () => {
    expect(snapStart(5.2, 2, targets, 0.5)).toBe(5);
  });

  it('snaps the trailing edge, returning the start that lands it on target', () => {
    // dur 3, start 6.9 -> end 9.9 is within 0.5 of 10 -> start becomes 7
    expect(snapStart(6.9, 3, targets, 0.5)).toBe(7);
  });

  it('returns the original start when nothing is within tolerance', () => {
    expect(snapStart(3.4, 1, targets, 0.2)).toBe(3.4);
  });

  it('never snaps a trailing-edge target to a negative start', () => {
    expect(snapStart(0.1, 5, [0], 0.5)).toBeGreaterThanOrEqual(0);
  });
});
