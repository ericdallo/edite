import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '@/store/editorStore';
import {
  AUDIO_FADE_MAX,
  CLIP_SPEED_MAX,
  CLIP_VOLUME_MAX,
  FREEZE_DEFAULT_DUR,
  IMAGE_DEFAULT_DUR,
  TEXT_SIZE_MAX,
} from '@/lib/constants';
import { makeClip, makeMedia, makeTrack } from '@/test/factories';
import { CAPTION_PRESETS, isCaptionClip } from '@/types/editor';

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

describe('addTextClip', () => {
  it('creates a text clip on a new top track and selects it', () => {
    get().setCurrentTime(2);
    get().addTextClip();
    const s = get();
    expect(s.tracks).toHaveLength(1);
    expect(s.clips).toHaveLength(1);
    const clip = s.clips[0];
    expect(clip.text?.content).toBe('Your text');
    expect(clip.mediaId).toBe('');
    expect(clip.muted).toBe(true);
    expect(clip.start).toBe(2);
    expect(s.activeClipId).toBe(clip.id);
    expect(s.selectedTool).toBe('text');
  });
});

describe('updateText', () => {
  it('merges a patch into the clip text and clamps the size', () => {
    get().addTextClip();
    const id = get().clips[0].id;
    get().updateText(id, { content: 'Hello', fontWeight: 400 });
    expect(get().clips[0].text).toMatchObject({ content: 'Hello', fontWeight: 400 });
    get().updateText(id, { fontSize: 99 });
    expect(get().clips[0].text?.fontSize).toBe(TEXT_SIZE_MAX);
  });

  it('ignores clips that are not text', () => {
    seed();
    get().updateText('c1', { content: 'x' });
    expect(get().clips.find((c) => c.id === 'c1')?.text).toBeUndefined();
  });
});

describe('addCaptionClips', () => {
  it('adds text clips on one new track and selects them', () => {
    get().addCaptionClips([
      { start: 0, duration: 1.5, text: 'Hello' },
      { start: 1.5, duration: 2, text: 'world' },
    ]);
    const s = get();
    expect(s.tracks).toHaveLength(1);
    expect(s.clips).toHaveLength(2);
    expect(s.clips.every((c) => c.trackId === s.tracks[0].id)).toBe(true);
    expect(s.clips.map((c) => c.text?.content)).toEqual(['Hello', 'world']);
    expect(s.clips[0]).toMatchObject({ mediaId: '', muted: true, in: 0, out: 1.5, speed: 1 });
    expect(s.clips.every(isCaptionClip)).toBe(true);
    expect(s.selectedIds).toEqual(s.clips.map((c) => c.id));
    expect(s.activeClipId).toBe(s.clips[1].id);
  });

  it('carries per-word timings onto the caption marker', () => {
    get().addCaptionClips([
      { start: 0, duration: 2, text: 'hi there', words: [
        { text: 'hi', start: 0, end: 0.5 },
        { text: 'there', start: 0.6, end: 1.2 },
      ] },
    ]);
    expect(get().clips[0].caption?.words).toEqual([
      { text: 'hi', start: 0, end: 0.5 },
      { text: 'there', start: 0.6, end: 1.2 },
    ]);
  });

  it('skips blank captions and is a no-op when all are empty', () => {
    get().addCaptionClips([
      { start: 0, duration: 1, text: '   ' },
      { start: 1, duration: 1, text: 'kept' },
    ]);
    expect(get().clips).toHaveLength(1);
    expect(get().clips[0].text?.content).toBe('kept');

    get().newProject({ id: 'p2', name: 'P2' });
    get().addCaptionClips([{ start: 0, duration: 1, text: '' }]);
    expect(get().tracks).toHaveLength(0);
    expect(get().clips).toHaveLength(0);
  });
});

describe('caption editing', () => {
  beforeEach(() => {
    get().addCaptionClips([
      { start: 0, duration: 1, text: 'one', words: [{ text: 'one', start: 0, end: 1 }] },
      { start: 1, duration: 1, text: 'two', words: [{ text: 'two', start: 0, end: 1 }] },
    ]);
  });

  it('seeds captions with the Classic preset look', () => {
    expect(get().clips[0].text?.color).toBe(CAPTION_PRESETS[0].style.color);
  });

  it('styleCaptions restyles every caption and applies a position rect', () => {
    get().styleCaptions({ color: '#22d3ee', fontWeight: 800 }, { y: 0.06 });
    const caps = get().clips.filter(isCaptionClip);
    expect(caps).toHaveLength(2);
    expect(caps.every((c) => c.text.color === '#22d3ee' && c.text.fontWeight === 800)).toBe(true);
    expect(caps.every((c) => c.rect.y === 0.06)).toBe(true);
  });

  it('styleCaptions clamps font size and leaves non-captions alone', () => {
    get().addTextClip();
    get().styleCaptions({ fontSize: 99 });
    expect(get().clips.filter(isCaptionClip).every((c) => c.text.fontSize === TEXT_SIZE_MAX)).toBe(true);
    const plain = get().clips.find((c) => c.text && c.caption == null);
    expect(plain?.text?.fontSize).not.toBe(TEXT_SIZE_MAX);
  });

  it('mergeCaptionWithNext joins text, span and word timings', () => {
    const [a, b] = get().clips;
    get().mergeCaptionWithNext(a.id);
    const caps = get().clips.filter(isCaptionClip);
    expect(caps).toHaveLength(1);
    expect(caps[0].text.content).toBe('one two');
    expect(caps[0].out).toBe(2);
    expect(caps[0].caption.words).toEqual([
      { text: 'one', start: 0, end: 1 },
      { text: 'two', start: 1, end: 2 },
    ]);
    expect(get().clips.some((c) => c.id === b.id)).toBe(false);
    expect(get().activeClipId).toBe(a.id);
  });
});

describe('orientation & background', () => {
  it('defaults new media clips to no flip/rotation', () => {
    get().addMedia(makeMedia({ id: 'm1', kind: 'video', duration: 5 }));
    get().addClipFromMedia('m1');
    expect(get().clips[0]).toMatchObject({ flipH: false, flipV: false, rotation: 0 });
  });

  it('updateClips applies flips and rotation', () => {
    seed();
    get().updateClips(['c1'], { flipH: true, rotation: 90 });
    expect(get().clips[0]).toMatchObject({ flipH: true, rotation: 90 });
  });

  it('tracks the background color in undo history', () => {
    seed();
    get().commitHistory();
    get().setBackground('#22d3ee');
    get().commitHistory();
    expect(get().background).toBe('#22d3ee');
    get().undo();
    expect(get().background).toBe('#000000');
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

describe('mergeClips', () => {
  beforeEach(seed);

  it('rejoins split halves into one clip and selects it', () => {
    get().setActiveClip('c1');
    get().splitAt(4); // two abutting halves of the 0..10 clip
    const ids = get().clips.map((c) => c.id);
    expect(ids).toHaveLength(2);
    get().mergeClips(ids);
    const s = get();
    expect(s.clips).toHaveLength(1);
    expect(s.clips[0]).toMatchObject({ start: 0, in: 0, out: 10 });
    expect(s.selectedIds).toEqual([s.clips[0].id]);
    expect(s.activeClipId).toBe(s.clips[0].id);
  });

  it('merges a run of three contiguous pieces', () => {
    get().setActiveClip('c1');
    get().splitAt(3);
    const rightId = get().clips.find((c) => c.start === 3)!.id;
    get().setActiveClip(rightId);
    get().splitAt(6);
    expect(get().clips).toHaveLength(3);
    get().mergeClips(get().clips.map((c) => c.id));
    expect(get().clips).toHaveLength(1);
    expect(get().clips[0].out).toBe(10);
  });

  it('is a no-op when the clips are not contiguous', () => {
    get().setActiveClip('c1');
    get().splitAt(4);
    const [a, b] = get().clips;
    get().moveClip(b.id, 7, b.trackId); // open a gap
    get().mergeClips([a.id, b.id]);
    expect(get().clips).toHaveLength(2);
  });
});

describe('freezeFrame', () => {
  beforeEach(seed);

  it('splits the clip and inserts a held still that ripples the tail right', () => {
    get().setActiveClip('c1');
    get().setCurrentTime(4);
    get().freezeFrame();
    const s = get();
    expect(s.clips).toHaveLength(3);
    const left = s.clips.find((c) => c.start === 0)!;
    const frozen = s.clips.find((c) => c.freeze != null)!;
    const right = s.clips.find((c) => c.start === 4 + FREEZE_DEFAULT_DUR)!;
    expect(left.out).toBe(4);
    expect(frozen).toMatchObject({ start: 4, freeze: 4, in: 0, out: FREEZE_DEFAULT_DUR, speed: 1, muted: true });
    expect(right).toMatchObject({ in: 4, out: 10 });
    expect(s.selectedIds).toEqual([frozen.id]);
  });

  it('pushes following clips on the same track by the hold length', () => {
    store.setState({
      media: [makeMedia({ id: 'm1', kind: 'video', duration: 10 })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [
        makeClip({ id: 'c1', mediaId: 'm1', trackId: 't1', start: 0, in: 0, out: 10 }),
        makeClip({ id: 'c2', mediaId: 'm1', trackId: 't1', start: 10, in: 0, out: 5 }),
      ],
    });
    get().setActiveClip('c1');
    get().setCurrentTime(4);
    get().freezeFrame();
    expect(get().clips.find((c) => c.id === 'c2')!.start).toBe(10 + FREEZE_DEFAULT_DUR);
  });

  it('is a no-op when the playhead is outside any clip', () => {
    get().setActiveClip('c1');
    get().setCurrentTime(50);
    get().freezeFrame();
    expect(get().clips).toHaveLength(1);
  });
});

describe('setClipTransition', () => {
  beforeEach(() => {
    store.setState({
      media: [makeMedia({ id: 'm1', kind: 'video', duration: 10 })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [
        makeClip({ id: 'a', mediaId: 'm1', trackId: 't1', start: 0, in: 0, out: 5 }),
        makeClip({ id: 'b', mediaId: 'm1', trackId: 't1', start: 5, in: 0, out: 5 }),
        makeClip({ id: 'c', mediaId: 'm1', trackId: 't1', start: 10, in: 0, out: 5 }),
      ],
    });
  });

  const byId = (id: string) => get().clips.find((c) => c.id === id)!;

  it('overlaps the predecessor and ripples the track left', () => {
    get().setClipTransition('b', 'dissolve', 1);
    expect(byId('b').transition).toEqual({ type: 'dissolve', duration: 1 });
    expect(byId('b').start).toBeCloseTo(4, 5);
    expect(byId('c').start).toBeCloseTo(9, 5);
    expect(byId('a').start).toBe(0);
  });

  it('re-overlaps by the delta when the duration changes', () => {
    get().setClipTransition('b', 'dissolve', 1);
    get().setClipTransition('b', 'dissolve', 2);
    expect(byId('b').start).toBeCloseTo(3, 5);
    expect(byId('c').start).toBeCloseTo(8, 5);
    expect(byId('b').transition!.duration).toBe(2);
  });

  it('ripples back and clears when removed', () => {
    get().setClipTransition('b', 'dissolve', 1);
    get().setClipTransition('b', null);
    expect(byId('b').transition).toBeUndefined();
    expect(byId('b').start).toBeCloseTo(5, 5);
    expect(byId('c').start).toBeCloseTo(10, 5);
  });

  it('clamps the duration to the shorter neighbour', () => {
    get().setClipTransition('b', 'dissolve', 99);
    expect(byId('b').transition!.duration).toBeCloseTo(4.94, 5);
  });

  it('is a no-op without an adjacent predecessor', () => {
    get().setClipTransition('a', 'dissolve', 1);
    expect(byId('a').transition).toBeUndefined();
    expect(byId('a').start).toBe(0);
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

describe('rippleDeleteClips', () => {
  // helper: a 2s clip on track t1 (in 0..2 at 1x).
  const clip2s = (id: string, start: number, trackId = 't1') =>
    makeClip({ id, mediaId: 'm1', trackId, start, in: 0, out: 2 });

  it('closes the gap left by a deleted contiguous clip', () => {
    store.setState({
      media: [makeMedia({ id: 'm1' })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [clip2s('a', 0), clip2s('b', 2), clip2s('c', 4)],
      activeClipId: 'b',
      selectedIds: ['b'],
    });
    get().rippleDeleteClips(['b']);
    const s = get();
    expect(s.clips.map((c) => c.id)).toEqual(['a', 'c']);
    expect(s.clips.find((c) => c.id === 'a')!.start).toBe(0);
    expect(s.clips.find((c) => c.id === 'c')!.start).toBe(2);
  });

  it('sums multiple deletions on the same track', () => {
    store.setState({
      media: [makeMedia({ id: 'm1' })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [clip2s('a', 0), clip2s('b', 2), clip2s('c', 4), clip2s('d', 6)],
    });
    get().rippleDeleteClips(['b', 'c']);
    const s = get();
    expect(s.clips.map((c) => c.id)).toEqual(['a', 'd']);
    expect(s.clips.find((c) => c.id === 'd')!.start).toBe(2);
  });

  it('shifts later clips by the deleted duration, preserving other gaps', () => {
    store.setState({
      media: [makeMedia({ id: 'm1' })],
      tracks: [makeTrack({ id: 't1' })],
      // gap of 1s between a and b
      clips: [clip2s('a', 0), clip2s('b', 3)],
    });
    get().rippleDeleteClips(['a']);
    // b moves left by a's 2s duration: 3 -> 1 (the 1s gap is preserved)
    expect(get().clips.find((c) => c.id === 'b')!.start).toBe(1);
  });

  it('only shifts clips on the deleted clip track', () => {
    store.setState({
      media: [makeMedia({ id: 'm1' })],
      tracks: [makeTrack({ id: 't1' }), makeTrack({ id: 't2' })],
      clips: [clip2s('a', 0), clip2s('b', 2), clip2s('x', 4, 't2')],
    });
    get().rippleDeleteClips(['a']);
    const s = get();
    expect(s.clips.find((c) => c.id === 'b')!.start).toBe(0);
    expect(s.clips.find((c) => c.id === 'x')!.start).toBe(4);
  });

  it('does not move clips that start before the deleted one', () => {
    store.setState({
      media: [makeMedia({ id: 'm1' })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [clip2s('a', 0), clip2s('b', 5)],
    });
    get().rippleDeleteClips(['b']);
    expect(get().clips.find((c) => c.id === 'a')!.start).toBe(0);
  });

  it('reselects the nearest survivor', () => {
    store.setState({
      media: [makeMedia({ id: 'm1' })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [clip2s('a', 0), clip2s('b', 2)],
      activeClipId: 'a',
      selectedIds: ['a'],
    });
    get().rippleDeleteClips(['a']);
    const s = get();
    expect(s.activeClipId).toBe('b');
    expect(s.selectedIds).toEqual(['b']);
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

describe('selectClips', () => {
  beforeEach(() => {
    store.setState({
      media: [makeMedia({ id: 'm1', duration: 10 })],
      tracks: [makeTrack({ id: 't1' })],
      clips: [
        makeClip({ id: 'c1', mediaId: 'm1', trackId: 't1', start: 0 }),
        makeClip({ id: 'c2', mediaId: 'm1', trackId: 't1', start: 11 }),
      ],
    });
    get().clearSelection();
  });

  it('selects the given clips and makes the last one primary', () => {
    get().selectClips(['c1', 'c2']);
    expect(get().selectedIds).toEqual(['c1', 'c2']);
    expect(get().activeClipId).toBe('c2');
  });

  it('drops unknown ids and clears the primary when none remain', () => {
    get().selectClips(['c1', 'ghost']);
    expect(get().selectedIds).toEqual(['c1']);
    get().selectClips(['ghost']);
    expect(get().selectedIds).toEqual([]);
    expect(get().activeClipId).toBeNull();
  });
});

describe('sidebar collapse', () => {
  it('toggles and sets the collapsed flag', () => {
    get().setSidebarCollapsed(false);
    expect(get().sidebarCollapsed).toBe(false);
    get().toggleSidebar();
    expect(get().sidebarCollapsed).toBe(true);
    get().setSidebarCollapsed(false);
    expect(get().sidebarCollapsed).toBe(false);
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

describe('setClipCurve', () => {
  beforeEach(seed);

  it('applies a speed-curve preset to the selected clips', () => {
    get().setClipCurve(['c1'], 'rampUp');
    expect(get().clips[0].speedCurve?.preset).toBe('rampUp');
    expect(get().clips[0].speedCurve?.points.length).toBeGreaterThan(1);
  });

  it('clears the curve when passed null', () => {
    get().setClipCurve(['c1'], 'bulletTime');
    get().setClipCurve(['c1'], null);
    expect(get().clips[0].speedCurve).toBeUndefined();
  });

  it('a constant speed change drops any curve', () => {
    get().setClipCurve(['c1'], 'rampUp');
    get().setClipsSpeed(['c1'], 2);
    expect(get().clips[0].speedCurve).toBeUndefined();
    expect(get().clips[0].speed).toBe(2);
  });
});

describe('clip audio: volume, fades & extract', () => {
  beforeEach(seed);

  it('defaults new media clips to full volume and no fades', () => {
    get().addMedia(makeMedia({ id: 'm2', kind: 'video', duration: 5 }));
    get().addClipFromMedia('m2');
    expect(get().clips.at(-1)).toMatchObject({ volume: 1, fadeIn: 0, fadeOut: 0 });
  });

  it('clamps per-clip volume to the allowed range', () => {
    get().updateClips(['c1'], { volume: 99 });
    expect(get().clips[0].volume).toBe(CLIP_VOLUME_MAX);
    get().updateClips(['c1'], { volume: -1 });
    expect(get().clips[0].volume).toBe(0);
  });

  it('caps fades at the clip length and the global maximum', () => {
    // c1 is 10s long, so a huge fade is capped at AUDIO_FADE_MAX (5s).
    get().updateClips(['c1'], { fadeIn: 99, fadeOut: 99 });
    expect(get().clips[0].fadeIn).toBe(AUDIO_FADE_MAX);
    // Shorten the clip to 2s: fades can't exceed its on-timeline length.
    get().updateClips(['c1'], { out: 2, fadeIn: 99 });
    expect(get().clips[0].fadeIn).toBe(2);
  });

  it('extracts audio onto a new muted-source track', () => {
    get().extractAudio('c1');
    const s = get();
    expect(s.tracks).toHaveLength(2);
    expect(s.clips).toHaveLength(2);
    const source = s.clips.find((c) => c.id === 'c1')!;
    const audio = s.clips.find((c) => c.id !== 'c1')!;
    expect(source.muted).toBe(true);
    expect(audio.audioOnly).toBe(true);
    expect(audio.muted).toBe(false);
    expect(audio.mediaId).toBe('m1');
    expect(audio.trackId).not.toBe('t1');
    expect(s.activeClipId).toBe(audio.id);
  });

  it('does not extract from a silent video, audio-only, or text clip', () => {
    store.setState({ media: [makeMedia({ id: 'mq', kind: 'video', duration: 5, hasAudio: false })] });
    store.setState({ clips: [makeClip({ id: 'cq', mediaId: 'mq', trackId: 't1' })] });
    get().extractAudio('cq');
    expect(get().clips).toHaveLength(1);

    get().extractAudio('cq'); // still no-op
    const audioOnly = makeClip({ id: 'ca', mediaId: 'm1', trackId: 't1', audioOnly: true });
    store.setState({ media: [makeMedia({ id: 'm1', kind: 'video', duration: 10 })], clips: [audioOnly] });
    get().extractAudio('ca');
    expect(get().clips).toHaveLength(1);
  });
});

describe('keyframes', () => {
  beforeEach(seed);

  it('addKeyframeAtPlayhead seeds a keyframe at the playhead from the current rect', () => {
    get().setCurrentTime(3);
    get().addKeyframeAtPlayhead('c1');
    const kfs = get().clips[0].keyframes!;
    expect(kfs).toHaveLength(1);
    expect(kfs[0].at).toBe(3);
    expect(kfs[0].rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('upsertKeyframe adds points and keeps them sorted by time', () => {
    get().upsertKeyframe('c1', 6, { x: 0.5, y: 0.25, w: 0.5, h: 0.5 });
    get().upsertKeyframe('c1', 0, { x: 0, y: 0, w: 1, h: 1 });
    expect(get().clips[0].keyframes!.map((k) => k.at)).toEqual([0, 6]);
  });

  it('upsertKeyframe replaces a keyframe at (nearly) the same time', () => {
    get().upsertKeyframe('c1', 2, { x: 0, y: 0, w: 1, h: 1 });
    get().upsertKeyframe('c1', 2.005, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
    const kfs = get().clips[0].keyframes!;
    expect(kfs).toHaveLength(1);
    expect(kfs[0].rect).toMatchObject({ x: 0.1, w: 0.8 });
  });

  it('clamps at to the clip window and guards a zero-size box', () => {
    get().upsertKeyframe('c1', -5, { x: 0, y: 0, w: 0, h: 1 });
    get().upsertKeyframe('c1', 999, { x: 0, y: 0, w: 1, h: 1 });
    const kfs = get().clips[0].keyframes!;
    expect(kfs[0].at).toBe(0);
    expect(kfs[0].rect.w).toBe(0.01); // floored away from zero
    expect(kfs[1].at).toBe(10); // clamped to the 10s clip length
  });

  it('removeKeyframe drops one, and clears the field when empty', () => {
    get().upsertKeyframe('c1', 0, { x: 0, y: 0, w: 1, h: 1 });
    get().upsertKeyframe('c1', 5, { x: 0.2, y: 0, w: 1, h: 1 });
    get().removeKeyframe('c1', 0);
    expect(get().clips[0].keyframes).toHaveLength(1);
    get().removeKeyframe('c1', 0);
    expect(get().clips[0].keyframes).toBeUndefined();
  });

  it('clearKeyframes removes all animation', () => {
    get().upsertKeyframe('c1', 0, { x: 0, y: 0, w: 1, h: 1 });
    get().clearKeyframes('c1');
    expect(get().clips[0].keyframes).toBeUndefined();
  });

  it('ignores text clips', () => {
    get().addTextClip();
    const id = get().clips.at(-1)!.id;
    get().upsertKeyframe(id, 1, { x: 0, y: 0, w: 1, h: 1 });
    expect(get().clips.find((c) => c.id === id)!.keyframes).toBeUndefined();
  });
});
