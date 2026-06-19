import { describe, expect, it } from 'vitest';
import {
  cleanCaptionText,
  groupWordsIntoLines,
  lineOptionsFor,
  parseWhisperChunks,
  segmentsToCaptionClips,
  type RawSegment,
} from '@/lib/captions/segments';

/** Build word-level raw segments from [text, start, end] tuples. */
function words(rows: [string, number, number][]): RawSegment[] {
  return rows.map(([text, start, end]) => ({ text, start, end }));
}

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

  it('carries per-word timings relative to the caption start', () => {
    const seg: RawSegment = {
      text: 'hello world',
      start: 2,
      end: 4,
      words: [
        { text: 'hello', start: 2, end: 2.8 },
        { text: 'world', start: 3, end: 4 },
      ],
    };
    const clips = segmentsToCaptionClips([seg], {
      clipStart: 10,
      speed: 1,
      clipDuration: 8,
      audioDuration: 4,
    });
    expect(clips).toEqual([
      {
        start: 12,
        duration: 2,
        text: 'hello world',
        words: [
          { text: 'hello', start: 0, end: 0.8 },
          { text: 'world', start: 1, end: 2 },
        ],
      },
    ]);
  });

  it('scales per-word timings by the clip speed', () => {
    const seg: RawSegment = {
      text: 'a b',
      start: 0,
      end: 2,
      words: [
        { text: 'a', start: 0, end: 1 },
        { text: 'b', start: 1, end: 2 },
      ],
    };
    const clips = segmentsToCaptionClips([seg], {
      clipStart: 0,
      speed: 2,
      clipDuration: 5,
      audioDuration: 2,
    });
    expect(clips[0].words).toEqual([
      { text: 'a', start: 0, end: 0.5 },
      { text: 'b', start: 0.5, end: 1 },
    ]);
  });
});

describe('groupWordsIntoLines', () => {
  const sample = words([
    ['Hello', 0, 0.4],
    ['there', 0.4, 0.8],
    ['my', 0.9, 1.1],
    ['friend', 1.1, 1.6],
  ]);

  it('packs words up to the word limit', () => {
    const lines = groupWordsIntoLines(sample, { maxChars: 0, maxWords: 2, maxDuration: 0, maxGap: 0 });
    expect(lines.map((l) => l.text)).toEqual(['Hello there', 'my friend']);
    expect(lines[0].words).toEqual([
      { text: 'Hello', start: 0, end: 0.4 },
      { text: 'there', start: 0.4, end: 0.8 },
    ]);
  });

  it('emits one word per line at the karaoke limit', () => {
    const lines = groupWordsIntoLines(sample, { maxChars: 0, maxWords: 1, maxDuration: 0, maxGap: 0 });
    expect(lines.map((l) => l.text)).toEqual(['Hello', 'there', 'my', 'friend']);
  });

  it('breaks a line on a long silence gap', () => {
    const lines = groupWordsIntoLines(
      words([
        ['keep', 0, 0.4],
        ['together', 0.4, 0.9],
        ['pause', 3, 3.4],
      ]),
      { maxChars: 0, maxWords: 0, maxDuration: 0, maxGap: 0.8 },
    );
    expect(lines.map((l) => l.text)).toEqual(['keep together', 'pause']);
  });

  it('breaks after sentence-ending punctuation', () => {
    const lines = groupWordsIntoLines(
      words([
        ['Done.', 0, 0.5],
        ['Next', 0.6, 1],
        ['one', 1, 1.4],
      ]),
      { maxChars: 0, maxWords: 0, maxDuration: 0, maxGap: 0 },
    );
    expect(lines.map((l) => l.text)).toEqual(['Done.', 'Next one']);
  });

  it('respects the character limit', () => {
    const lines = groupWordsIntoLines(
      words([
        ['aaaa', 0, 0.5],
        ['bbbb', 0.5, 1],
        ['cccc', 1, 1.5],
      ]),
      { maxChars: 9, maxWords: 0, maxDuration: 0, maxGap: 0 },
    );
    // "aaaa bbbb" is 9 chars (ok); adding " cccc" would exceed it.
    expect(lines.map((l) => l.text)).toEqual(['aaaa bbbb', 'cccc']);
  });
});

describe('lineOptionsFor', () => {
  it('maps each length choice to limits', () => {
    expect(lineOptionsFor('word').maxWords).toBe(1);
    expect(lineOptionsFor('short').maxWords).toBe(3);
    expect(lineOptionsFor('line').maxWords).toBe(8);
    // Sentence relies on punctuation/gaps only — no hard caps.
    expect(lineOptionsFor('sentence')).toEqual({ maxChars: 0, maxWords: 0, maxDuration: 0, maxGap: 0 });
  });
});
