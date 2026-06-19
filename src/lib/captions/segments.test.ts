import { describe, expect, it } from 'vitest';
import {
  cleanCaptionText,
  parseWhisperChunks,
  segmentsToCaptionClips,
  type RawSegment,
} from '@/lib/captions/segments';

describe('cleanCaptionText', () => {
  it('trims and collapses whitespace and newlines', () => {
    expect(cleanCaptionText('  hello   world \n there ')).toBe('hello world there');
    expect(cleanCaptionText('\n\t')).toBe('');
  });
});

describe('parseWhisperChunks', () => {
  it('reads chunk text and timestamps, dropping empty chunks', () => {
    const out = {
      chunks: [
        { text: ' Hello ', timestamp: [0, 1.5] as [number, number] },
        { text: '   ', timestamp: [1.5, 2] as [number, number] },
        { text: 'world', timestamp: [2, 3] as [number, number] },
      ],
    };
    expect(parseWhisperChunks(out, 3)).toEqual([
      { text: 'Hello', start: 0, end: 1.5 },
      { text: 'world', start: 2, end: 3 },
    ]);
  });

  it('extends an open-ended final timestamp to the audio duration', () => {
    const out = { chunks: [{ text: 'tail', timestamp: [4, null] as [number, null] }] };
    expect(parseWhisperChunks(out, 6)).toEqual([{ text: 'tail', start: 4, end: 6 }]);
  });

  it('falls back to a single segment when there are no chunks', () => {
    expect(parseWhisperChunks({ text: 'whole thing' }, 5)).toEqual([
      { text: 'whole thing', start: 0, end: 5 },
    ]);
    expect(parseWhisperChunks({ chunks: [] }, 5)).toEqual([]);
  });
});

describe('segmentsToCaptionClips', () => {
  const segs: RawSegment[] = [
    { text: 'one', start: 0, end: 1 },
    { text: 'two', start: 1, end: 2 },
  ];

  it('offsets by the clip start at speed 1', () => {
    const clips = segmentsToCaptionClips(segs, {
      clipStart: 10,
      speed: 1,
      clipDuration: 5,
      audioDuration: 2,
    });
    expect(clips).toEqual([
      { start: 10, duration: 1, text: 'one' },
      { start: 11, duration: 1, text: 'two' },
    ]);
  });

  it('scales segment times by the clip speed', () => {
    const clips = segmentsToCaptionClips(segs, {
      clipStart: 0,
      speed: 2,
      clipDuration: 5,
      audioDuration: 2,
    });
    // a 2x clip plays 2s of source in 1s of timeline
    expect(clips).toEqual([
      { start: 0, duration: 0.5, text: 'one' },
      { start: 0.5, duration: 0.5, text: 'two' },
    ]);
  });

  it('clamps the last caption to the clip window', () => {
    const clips = segmentsToCaptionClips([{ text: 'long', start: 0, end: 10 }], {
      clipStart: 0,
      speed: 1,
      clipDuration: 3,
      audioDuration: 10,
    });
    expect(clips).toEqual([{ start: 0, duration: 3, text: 'long' }]);
  });

  it('trims overlap so consecutive captions never overlap', () => {
    const clips = segmentsToCaptionClips(
      [
        { text: 'a', start: 0, end: 2 },
        { text: 'b', start: 1, end: 3 },
      ],
      { clipStart: 0, speed: 1, clipDuration: 5, audioDuration: 3 },
    );
    expect(clips[0]).toEqual({ start: 0, duration: 1, text: 'a' });
    expect(clips[1]).toEqual({ start: 1, duration: 2, text: 'b' });
  });

  it('drops captions that start beyond the clip window or are too short', () => {
    const clips = segmentsToCaptionClips(
      [
        { text: 'visible', start: 0, end: 1 },
        { text: 'beyond', start: 9, end: 10 },
      ],
      { clipStart: 0, speed: 1, clipDuration: 2, audioDuration: 10 },
    );
    expect(clips).toEqual([{ start: 0, duration: 1, text: 'visible' }]);
  });
});
