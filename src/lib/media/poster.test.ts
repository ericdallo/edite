import { describe, expect, it } from 'vitest';
import { posterSourceFor } from '@/lib/media/poster';
import { DEFAULT_TEXT_STYLE } from '@/types/editor';
import { makeClip, makeMedia, makeTrack } from '@/test/factories';

const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2', hidden: true })];
const media = [
  makeMedia({ id: 'vid', kind: 'video' }),
  makeMedia({ id: 'img', kind: 'image' }),
  makeMedia({ id: 'aud', kind: 'audio' }),
];

describe('posterSourceFor', () => {
  it('picks the earliest visual clip and its in-point', () => {
    const clips = [
      makeClip({ id: 'c1', mediaId: 'vid', trackId: 't1', start: 5, in: 2 }),
      makeClip({ id: 'c2', mediaId: 'img', trackId: 't1', start: 1, in: 0 }),
    ];
    expect(posterSourceFor(clips, tracks, media)).toEqual({ mediaId: 'img', time: 0 });
  });

  it('uses the held frame for a freeze clip', () => {
    const clips = [makeClip({ id: 'c1', mediaId: 'vid', trackId: 't1', start: 0, in: 1, freeze: 4.5 })];
    expect(posterSourceFor(clips, tracks, media)).toEqual({ mediaId: 'vid', time: 4.5 });
  });

  it('skips hidden clips, hidden tracks, audio and text', () => {
    const clips = [
      makeClip({ id: 'hidden', mediaId: 'vid', trackId: 't1', start: 0, hidden: true }),
      makeClip({ id: 'onHidden', mediaId: 'vid', trackId: 't2', start: 0 }),
      makeClip({ id: 'audio', mediaId: 'aud', trackId: 't1', start: 0 }),
      makeClip({ id: 'extracted', mediaId: 'vid', trackId: 't1', start: 0, audioOnly: true }),
      makeClip({ id: 'text', mediaId: '', trackId: 't1', start: 0, text: { ...DEFAULT_TEXT_STYLE } }),
      makeClip({ id: 'keep', mediaId: 'vid', trackId: 't1', start: 8, in: 3 }),
    ];
    expect(posterSourceFor(clips, tracks, media)).toEqual({ mediaId: 'vid', time: 3 });
  });

  it('returns null when there is nothing visual', () => {
    const clips = [makeClip({ id: 'audio', mediaId: 'aud', trackId: 't1', start: 0 })];
    expect(posterSourceFor(clips, tracks, media)).toBeNull();
    expect(posterSourceFor([], tracks, media)).toBeNull();
  });
});
