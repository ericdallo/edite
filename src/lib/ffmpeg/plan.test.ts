import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXT_STYLE, makeSpeedCurve } from '@/types/editor';
import { SPEED_CURVE_SLICES } from '@/lib/constants';
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

  it('emits a shape clip as a shape overlay with no media', () => {
    const track = makeTrack({ id: 't1' });
    const clip = makeClip({
      trackId: 't1',
      mediaId: '',
      shape: { kind: 'ellipse', fill: '#ffffff', stroke: '#000000', strokeWidth: 0, radius: 0 },
    });
    const plan = buildExportPlan([track], [clip], []);
    expect(plan.clips).toHaveLength(1);
    expect(plan.clips[0].kind).toBe('shape');
    expect(plan.clips[0].shape?.kind).toBe('ellipse');
    expect(plan.clipMediaIds[0]).toBe('');
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

  it('carries a clip color adjustment onto its export clips', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1' });
    const color = { brightness: 1.1, contrast: 1.2, saturation: 0.8, hue: 15 };
    const plain = buildExportPlan([track], [makeClip({ trackId: 't1', mediaId: 'm1', color })], [media]);
    expect(plain.clips[0].color).toEqual(color);
    // Every tiled segment of a curved clip inherits the same color.
    const curved = makeClip({
      trackId: 't1', mediaId: 'm1', start: 0, in: 0, out: 10, color, speedCurve: makeSpeedCurve('rampUp'),
    });
    const plan = buildExportPlan([track], [curved], [makeMedia({ id: 'm1', kind: 'video', duration: 12 })]);
    expect(plan.clips.every((c) => c.color === color || JSON.stringify(c.color) === JSON.stringify(color))).toBe(true);
  });

  it('carries a chroma key onto its export clip', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1' });
    const chromaKey = { color: '#00ff00', similarity: 0.3, blend: 0.1 };
    const plan = buildExportPlan([track], [makeClip({ trackId: 't1', mediaId: 'm1', chromaKey })], [media]);
    expect(plan.clips[0].chromaKey).toEqual(chromaKey);
  });

  it('carries a blend mode onto its export clip', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1' });
    const plan = buildExportPlan([track], [makeClip({ trackId: 't1', mediaId: 'm1', blendMode: 'screen' })], [media]);
    expect(plan.clips[0].blendMode).toBe('screen');
  });

  it('passes keyframes through to a media export clip', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1' });
    const keyframes = [
      { at: 0, rect: { x: 0, y: 0, w: 1, h: 1 } },
      { at: 3, rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } },
    ];
    const plan = buildExportPlan([track], [makeClip({ trackId: 't1', mediaId: 'm1', keyframes })], [media]);
    expect(plan.clips[0].keyframes).toEqual(keyframes);
  });

  it('samples keyframes per slice (stepped) for a speed-curved clip', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1', kind: 'video', duration: 12 });
    const keyframes = [
      { at: 0, rect: { x: 0, y: 0, w: 1, h: 1 } },
      { at: 6, rect: { x: 0.5, y: 0, w: 1, h: 1 } },
    ];
    const clip = makeClip({
      trackId: 't1', mediaId: 'm1', start: 0, in: 0, out: 12, keyframes, speedCurve: makeSpeedCurve('rampUp'),
    });
    const plan = buildExportPlan([track], [clip], [media]);
    // Each tiled segment carries a sampled static rect, not the keyframes themselves.
    expect(plan.clips.every((c) => c.keyframes === undefined)).toBe(true);
    const xs = plan.clips.map((c) => c.rect.x);
    expect(xs.at(-1)!).toBeGreaterThan(xs[0]);
  });

  it('passes a transition through and cross-fades the audio with its predecessor', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1' });
    const clips = [
      makeClip({ id: 'a', trackId: 't1', mediaId: 'm1', start: 0, in: 0, out: 5 }),
      makeClip({
        id: 'b', trackId: 't1', mediaId: 'm1', start: 4, in: 0, out: 5,
        transition: { type: 'dissolve', duration: 1 },
      }),
    ];
    const plan = buildExportPlan([track], clips, [media]);
    expect(plan.clips[1].transition).toEqual({ type: 'dissolve', duration: 1 });
    expect(plan.clips[1].fadeIn).toBe(1); // incoming fades in over the overlap
    expect(plan.clips[0].fadeOut).toBe(1); // predecessor fades out over the overlap
  });

  it('expands a speed-curved clip into tiled constant-speed segments', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1', kind: 'video', duration: 12 });
    const clip = makeClip({ trackId: 't1', mediaId: 'm1', start: 0, in: 0, out: 12, speedCurve: makeSpeedCurve('rampUp') });
    const plan = buildExportPlan([track], [clip], [media]);
    expect(plan.clips).toHaveLength(SPEED_CURVE_SLICES);
    expect(plan.clips.every((c) => c.kind === 'video')).toBe(true);
    // Segments span the full source range, in order, with no gaps.
    expect(plan.clips[0].in).toBeCloseTo(0, 5);
    expect(plan.clips.at(-1)!.out).toBeCloseTo(12, 5);
    for (let i = 1; i < plan.clips.length; i++) {
      expect(plan.clips[i].in).toBeCloseTo(plan.clips[i - 1].out, 5);
      expect(plan.clips[i].start).toBeGreaterThan(plan.clips[i - 1].start);
    }
    // Still one source file, referenced by every segment.
    expect(plan.media).toHaveLength(1);
    expect(plan.clipMediaIds.every((id) => id === 'm1')).toBe(true);
  });

  it('puts fades on the first and last segments of a curved clip only', () => {
    const track = makeTrack({ id: 't1' });
    const media = makeMedia({ id: 'm1', kind: 'video', duration: 12 });
    const clip = makeClip({
      trackId: 't1', mediaId: 'm1', start: 0, in: 0, out: 12,
      fadeIn: 1, fadeOut: 1, speedCurve: makeSpeedCurve('rampUp'),
    });
    const plan = buildExportPlan([track], [clip], [media]);
    expect(plan.clips[0].fadeIn).toBe(1);
    expect(plan.clips.at(-1)!.fadeOut).toBe(1);
    expect(plan.clips[1].fadeIn).toBe(0);
    expect(plan.clips[1].fadeOut).toBe(0);
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
