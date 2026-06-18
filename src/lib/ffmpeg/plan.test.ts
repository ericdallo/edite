import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXT_STYLE } from '@/types/editor';
import { buildExportPlan } from '@/lib/ffmpeg/plan';
import { makeClip, makeMedia, makeTrack } from '@/test/factories';

describe('buildExportPlan', () => {
  it('orders clips bottom track -> top track, then by start time', () => {
    const bottom = makeTrack({ id: 'bottom' });
    const top = makeTrack({ id: 'top' });
    const media = makeMedia({ id: 'm1' });
    // tracks[0] is the bottom layer in the editor model.
    const tracks = [bottom, top];
    const clips = [
      makeClip({ id: 'top-late', trackId: 'top', mediaId: 'm1', start: 5 }),
      makeClip({ id: 'top-early', trackId: 'top', mediaId: 'm1', start: 1 }),
      makeClip({ id: 'bottom-one', trackId: 'bottom', mediaId: 'm1', start: 3 }),
    ];
    const plan = buildExportPlan(tracks, clips, [media]);
    expect(plan.clips.map((_, i) => i)).toEqual([0, 1, 2]);
    // bottom track first, then top track sorted by start
    expect(plan.clips.map((c) => c.start)).toEqual([3, 1, 5]);
  });

  it('drops hidden tracks and hidden clips', () => {
    const visible = makeTrack({ id: 'visible' });
    const hiddenTrack = makeTrack({ id: 'hidden', hidden: true });
    const media = makeMedia({ id: 'm1' });
    const clips = [
      makeClip({ id: 'keep', trackId: 'visible', mediaId: 'm1' }),
      makeClip({ id: 'hiddenClip', trackId: 'visible', mediaId: 'm1', hidden: true }),
      makeClip({ id: 'onHiddenTrack', trackId: 'hidden', mediaId: 'm1' }),
    ];
    const plan = buildExportPlan([visible, hiddenTrack], clips, [media]);
    expect(plan.clipMediaIds).toHaveLength(1);
    expect(plan.clips).toHaveLength(1);
  });

  it('drops clips whose media is missing', () => {
    const track = makeTrack({ id: 't1' });
    const clips = [makeClip({ trackId: 't1', mediaId: 'gone' })];
    const plan = buildExportPlan([track], clips, []);
    expect(plan.clips).toHaveLength(0);
    expect(plan.media).toHaveLength(0);
  });

  it('marks a clip muted when its track is muted', () => {
    const track = makeTrack({ id: 't1', muted: true });
    const media = makeMedia({ id: 'm1' });
    const plan = buildExportPlan([track], [makeClip({ trackId: 't1', mediaId: 'm1' })], [media]);
    expect(plan.clips[0].muted).toBe(true);
  });

  it('includes text clips in z-order without adding a media entry', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1' });
    const clips = [
      makeClip({ id: 'vid', trackId: 't1', mediaId: 'm1', start: 0 }),
      makeClip({ id: 'txt', trackId: 't1', mediaId: '', start: 1, text: { ...DEFAULT_TEXT_STYLE } }),
    ];
    const plan = buildExportPlan([track], clips, [media]);
    expect(plan.clips.map((c) => c.kind)).toEqual(['video', 'text']);
    expect(plan.clipMediaIds).toEqual(['m1', '']);
    expect(plan.media).toHaveLength(1);
    expect(plan.clips[1].text?.content).toBe('Your text');
    expect(plan.clips[1].speed).toBe(1);
    expect(plan.clips[1].hasAudio).toBe(false);
  });

  it('copies clip orientation onto media export clips', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1' });
    const clips = [makeClip({ trackId: 't1', mediaId: 'm1', flipH: true, rotation: 90 })];
    const plan = buildExportPlan([track], clips, [media]);
    expect(plan.clips[0]).toMatchObject({ flipH: true, flipV: false, rotation: 90 });
  });

  it('deduplicates media referenced by multiple clips', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1' });
    const clips = [
      makeClip({ id: 'a', trackId: 't1', mediaId: 'm1', start: 0 }),
      makeClip({ id: 'b', trackId: 't1', mediaId: 'm1', start: 5 }),
    ];
    const plan = buildExportPlan([track], clips, [media]);
    expect(plan.clipMediaIds).toEqual(['m1', 'm1']);
    expect(plan.media).toHaveLength(1);
    expect(plan.media[0].id).toBe('m1');
  });
});
