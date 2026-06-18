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

  it('duplicates a clip directly after itself and selects the copy', () => {
    get().duplicateClips(['c1']);
    const s = get();
    expect(s.clips).toHaveLength(2);
    expect(s.clips[1].start).toBe(10); // clipEnd of the original
    expect(s.selectedIds).toEqual([s.clips[1].id]);
  });

  it('pastes the clipboard at a given time on the same track', () => {
    get().copyClips(['c1']);
    get().pasteClips(5);
    const s = get();
    expect(s.clips).toHaveLength(2);
    expect(s.clips[1].start).toBe(5);
    expect(s.clips[1].trackId).toBe('t1');
  });

  it('paste is a no-op with an empty clipboard', () => {
    get().pasteClips(5);
    expect(get().clips).toHaveLength(1);
  });
});

describe('deleteClips', () => {
  it('removes the clips and reselects the nearest survivor', () => {
    store.setState({
      media: [makeMedia({ id: 'm1' })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [
        makeClip({ id: 'c1', mediaId: 'm1', trackId: 't1', start: 0 }),
        makeClip({ id: 'c2', mediaId: 'm1', trackId: 't1', start: 11 }),
      ],
      activeClipId: 'c1',
      selectedIds: ['c1'],
    });
    get().deleteClips(['c1']);
    const s = get();
    expect(s.clips.map((c) => c.id)).toEqual(['c2']);
    expect(s.activeClipId).toBe('c2');
    expect(s.selectedIds).toEqual(['c2']);
  });

  it('clears the selection when everything is deleted', () => {
    store.setState({
      media: [makeMedia({ id: 'm1' })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [makeClip({ id: 'c1', mediaId: 'm1', trackId: 't1' })],
      activeClipId: 'c1',
      selectedIds: ['c1'],
    });
    get().deleteClips(['c1']);
    expect(get().clips).toHaveLength(0);
    expect(get().selectedIds).toEqual([]);
    expect(get().activeClipId).toBeNull();
  });
});

describe('selection', () => {
  beforeEach(() => {
    store.setState({
      media: [makeMedia({ id: 'm1', duration: 10 })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [
        makeClip({ id: 'c1', mediaId: 'm1', trackId: 't1', start: 0 }),
        makeClip({ id: 'c2', mediaId: 'm1', trackId: 't1', start: 11 }),
        makeClip({ id: 'c3', mediaId: 'm1', trackId: 't1', start: 22 }),
      ],
    });
    get().clearSelection();
  });

  it('setActiveClip selects exactly one clip and syncs selectedIds', () => {
    get().setActiveClip('c2');
    expect(get().selectedIds).toEqual(['c2']);
    expect(get().activeClipId).toBe('c2');
    get().setActiveClip(null);
    expect(get().selectedIds).toEqual([]);
    expect(get().activeClipId).toBeNull();
  });

  it('selectAll selects every clip and keeps a still-present primary', () => {
    get().setActiveClip('c2');
    get().selectAll();
    const s = get();
    expect(s.selectedIds).toEqual(['c1', 'c2', 'c3']);
    expect(s.activeClipId).toBe('c2');
  });

  it('toggleSelect adds then removes, updating the primary', () => {
    get().setActiveClip('c1');
    get().toggleSelect('c3');
    expect(get().selectedIds).toEqual(['c1', 'c3']);
    expect(get().activeClipId).toBe('c3');
    get().toggleSelect('c3');
    expect(get().selectedIds).toEqual(['c1']);
    expect(get().activeClipId).toBe('c1');
  });

  it('clearSelection empties the selection', () => {
    get().selectAll();
    get().clearSelection();
    expect(get().selectedIds).toEqual([]);
    expect(get().activeClipId).toBeNull();
  });
});

describe('bulk edits', () => {
  beforeEach(() => {
    store.setState({
      media: [makeMedia({ id: 'm1', duration: 10 })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [
        makeClip({ id: 'c1', mediaId: 'm1', trackId: 't1', start: 0 }),
        makeClip({ id: 'c2', mediaId: 'm1', trackId: 't1', start: 11 }),
      ],
    });
  });

  it('updateClips applies a clamped patch to many clips at once', () => {
    get().updateClips(['c1', 'c2'], { speed: 2, muted: true });
    expect(get().clips.every((c) => c.speed === 2 && c.muted)).toBe(true);
    get().updateClips(['c1'], { speed: 999 });
    expect(get().clips.find((c) => c.id === 'c1')!.speed).toBe(CLIP_SPEED_MAX);
  });

  it('setClipStarts moves clips to absolute starts, clamped to >= 0', () => {
    get().setClipStarts([
      { id: 'c1', start: 5 },
      { id: 'c2', start: -3 },
    ]);
    const s = get();
    expect(s.clips.find((c) => c.id === 'c1')!.start).toBe(5);
    expect(s.clips.find((c) => c.id === 'c2')!.start).toBe(0);
  });

  it('duplicateClips copies all clips and selects the copies', () => {
    get().duplicateClips(['c1', 'c2']);
    const s = get();
    expect(s.clips).toHaveLength(4);
    expect(s.selectedIds).toHaveLength(2);
    expect(s.selectedIds).not.toContain('c1');
    expect(s.selectedIds).not.toContain('c2');
  });

  it('copyClips + pasteClips preserves relative spacing at the playhead', () => {
    get().copyClips(['c1', 'c2']); // starts 0 and 11 -> spacing 11
    get().pasteClips(20);
    const s = get();
    const pasted = s.clips
      .filter((c) => c.id !== 'c1' && c.id !== 'c2')
      .sort((a, b) => a.start - b.start);
    expect(pasted).toHaveLength(2);
    expect(pasted[0].start).toBe(20);
    expect(pasted[1].start).toBe(31);
    expect(s.selectedIds).toEqual(pasted.map((c) => c.id));
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

describe('setClipsSpeed', () => {
  const by = (id: string) => get().clips.find((c) => c.id === id)!;

  function seedSeq(starts: number[], trackIds?: string[]) {
    store.setState({
      media: [makeMedia({ id: 'm1', duration: 100 })],
      tracks: [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })],
      clips: starts.map((s, i) =>
        makeClip({ id: `c${i + 1}`, mediaId: 'm1', trackId: trackIds?.[i] ?? 't1', start: s, in: 0, out: 10 }),
      ),
    });
  }

  it('keeps multiple clips back-to-back after speeding them up', () => {
    seedSeq([0, 10, 20]); // three 10s clips, contiguous
    get().setClipsSpeed(['c1', 'c2', 'c3'], 2);
    expect(by('c1').speed).toBe(2);
    expect(by('c1').start).toBe(0);
    expect(by('c2').start).toBe(5);
    expect(by('c3').start).toBe(10);
  });

  it('closes pre-existing gaps and anchors at the earliest start', () => {
    seedSeq([3, 20]); // a gap between the two clips
    get().setClipsSpeed(['c1', 'c2'], 1); // 1x: each stays 10s long
    expect(by('c1').start).toBe(3);
    expect(by('c2').start).toBe(13);
  });

  it('re-flows across tracks in start order while keeping each track', () => {
    seedSeq([0, 10], ['t1', 't2']);
    get().setClipsSpeed(['c1', 'c2'], 2);
    expect(by('c1').start).toBe(0);
    expect(by('c2').start).toBe(5);
    expect(by('c2').trackId).toBe('t2');
  });

  it('only changes speed for a single clip (no reflow)', () => {
    seedSeq([7]);
    get().setClipsSpeed(['c1'], 2);
    expect(by('c1').speed).toBe(2);
    expect(by('c1').start).toBe(7);
  });
});
