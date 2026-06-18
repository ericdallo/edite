import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '@/store/editorStore';
import { CLIP_SPEED_MAX, IMAGE_DEFAULT_DUR } from '@/lib/constants';
import { makeClip, makeMedia, makeTrack } from '@/test/factories';

const store = useEditorStore;
const get = () => store.getState();

beforeEach(() => {
  get().newProject({ id: 'p', name: 'P' });
});

/** Inject a known media/track/clip document without going through history. */
function seed() {
  store.setState({
    media: [makeMedia({ id: 'm1', kind: 'video', duration: 10 })],
    tracks: [makeTrack({ id: 't1' })],
    clips: [makeClip({ id: 'c1', mediaId: 'm1', trackId: 't1', start: 0, in: 0, out: 10 })],
  });
}

describe('addClipFromMedia', () => {
  it('creates a track and a clip spanning the full video', () => {
    get().addMedia(makeMedia({ id: 'm1', kind: 'video', duration: 7 }));
    get().addClipFromMedia('m1');
    const s = get();
    expect(s.tracks).toHaveLength(1);
    expect(s.clips).toHaveLength(1);
    expect(s.clips[0].out).toBe(7);
    expect(s.activeClipId).toBe(s.clips[0].id);
  });

  it('gives still images a default duration', () => {
    get().addMedia(makeMedia({ id: 'img', kind: 'image', duration: 0 }));
    get().addClipFromMedia('img');
    expect(get().clips[0].out).toBe(IMAGE_DEFAULT_DUR);
  });

  it('is a no-op for unknown media', () => {
    get().addClipFromMedia('nope');
    expect(get().clips).toHaveLength(0);
  });
});

describe('moveClip', () => {
  beforeEach(seed);

  it('never moves a clip before 0', () => {
    get().moveClip('c1', -5, 't1');
    expect(get().clips[0].start).toBe(0);
  });

  it('keeps the original track when the target does not exist', () => {
    get().moveClip('c1', 3, 'ghost');
    expect(get().clips[0].trackId).toBe('t1');
    expect(get().clips[0].start).toBe(3);
  });
});

describe('moveClipToNewTrack', () => {
  beforeEach(seed);

  it("'below' inserts the new track as the bottom layer (index 0)", () => {
    get().moveClipToNewTrack('c1', 2, 'below');
    const s = get();
    expect(s.tracks).toHaveLength(2);
    expect(s.clips[0].trackId).toBe(s.tracks[0].id);
    expect(s.clips[0].start).toBe(2);
  });

  it("'above' appends the new track as the top layer", () => {
    get().moveClipToNewTrack('c1', 0, 'above');
    const s = get();
    expect(s.clips[0].trackId).toBe(s.tracks[s.tracks.length - 1].id);
  });
});

describe('splitAt', () => {
  beforeEach(seed);

  it('splits the active clip into two abutting clips', () => {
    get().setActiveClip('c1');
    get().splitAt(4);
    const s = get();
    expect(s.clips).toHaveLength(2);
    const left = s.clips.find((c) => c.start === 0)!;
    const right = s.clips.find((c) => c.start === 4)!;
    expect(left.out).toBe(4);
    expect(right.in).toBe(4);
    expect(right.out).toBe(10);
  });

  it('does nothing when the playhead is outside any clip', () => {
    get().setActiveClip('c1');
    get().splitAt(50);
    expect(get().clips).toHaveLength(1);
  });
});

describe('duplicate / copy / paste', () => {
  beforeEach(seed);

  it('duplicates a clip directly after itself', () => {
    get().duplicateClip('c1');
    const s = get();
    expect(s.clips).toHaveLength(2);
    expect(s.clips[1].start).toBe(10); // clipEnd of the original
  });

  it('pastes the clipboard at a given time on the same track', () => {
    get().copyClip('c1');
    get().pasteClip(5);
    const s = get();
    expect(s.clips).toHaveLength(2);
    expect(s.clips[1].start).toBe(5);
    expect(s.clips[1].trackId).toBe('t1');
  });

  it('paste is a no-op with an empty clipboard', () => {
    get().pasteClip(5);
    expect(get().clips).toHaveLength(1);
  });
});

describe('deleteClip', () => {
  it('reassigns the active clip after deleting the selected one', () => {
    store.setState({
      media: [makeMedia({ id: 'm1' })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [
        makeClip({ id: 'c1', mediaId: 'm1', trackId: 't1', start: 0 }),
        makeClip({ id: 'c2', mediaId: 'm1', trackId: 't1', start: 11 }),
      ],
      activeClipId: 'c1',
    });
    get().deleteClip('c1');
    const s = get();
    expect(s.clips.map((c) => c.id)).toEqual(['c2']);
    expect(s.activeClipId).toBe('c2');
  });
});

describe('updateClip clamping', () => {
  beforeEach(seed);

  it('clamps out to the source duration, speed and opacity to their bounds, in to >= 0', () => {
    get().updateClip('c1', { out: 100 });
    expect(get().clips[0].out).toBe(10);
    get().updateClip('c1', { speed: 100 });
    expect(get().clips[0].speed).toBe(CLIP_SPEED_MAX);
    get().updateClip('c1', { opacity: 5 });
    expect(get().clips[0].opacity).toBe(1);
    get().updateClip('c1', { in: -5 });
    expect(get().clips[0].in).toBe(0);
  });
});

describe('history (commit / undo / redo)', () => {
  it('commits a change, undoes and redoes it', () => {
    expect(get().past).toHaveLength(0);
    seed();
    get().commitHistory();
    expect(get().past).toHaveLength(1);
    expect(get().clips).toHaveLength(1);

    get().undo();
    expect(get().clips).toHaveLength(0);
    expect(get().future).toHaveLength(1);

    get().redo();
    expect(get().clips).toHaveLength(1);
    expect(get().future).toHaveLength(0);
  });

  it('is a no-op when the document has not changed', () => {
    seed();
    get().commitHistory();
    const len = get().past.length;
    get().commitHistory();
    expect(get().past).toHaveLength(len);
  });

  it('clears the redo stack on a new action', () => {
    seed();
    get().commitHistory();
    get().undo();
    expect(get().future).toHaveLength(1);

    seed();
    get().commitHistory();
    expect(get().future).toHaveLength(0);
  });

  it('coalesces many mutations into a single entry until commit', () => {
    seed();
    get().commitHistory();
    const before = get().past.length;
    for (const start of [1, 2, 3, 4, 5]) get().moveClip('c1', start, 't1');
    get().commitHistory();
    expect(get().past).toHaveLength(before + 1);
    expect(get().clips[0].start).toBe(5);
  });
});
