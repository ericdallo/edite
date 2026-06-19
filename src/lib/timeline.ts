import type { Clip, Rect, SpeedCurve, TransitionId } from '@/types/editor';
import { MIN_CLIP, SPEED_CURVE_SLICES } from '@/lib/constants';

/** Instantaneous speed (×) at source progress `u` in [0,1], piecewise-linear between points. */
export function evalSpeedAt(curve: SpeedCurve, u: number): number {
  const pts = curve.points;
  if (pts.length === 0) return 1;
  if (u <= pts[0].at) return pts[0].speed;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (u <= b.at) {
      const span = b.at - a.at;
      if (span <= 1e-9) return b.speed;
      return a.speed + (b.speed - a.speed) * ((u - a.at) / span);
    }
  }
  return pts[pts.length - 1].speed;
}

function lerpRect(a: Rect, b: Rect, f: number): Rect {
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    w: a.w + (b.w - a.w) * f,
    h: a.h + (b.h - a.h) * f,
  };
}

export interface ClipTransform {
  rect: Rect;
}

/**
 * The clip's animated placement at timeline time `t`. With fewer than two
 * keyframes the static `clip.rect` is returned (no animation); otherwise the
 * keyframes (in timeline seconds from the clip's start, assumed sorted by `at`
 * like a speed curve's points) are interpolated piecewise-linearly, clamping to
 * the first/last keyframe outside their range. The single source of truth for
 * both the live preview and the export, so what you see is what renders.
 */
export function clipTransformAt(clip: Clip, t: number): ClipTransform {
  const kfs = clip.keyframes;
  if (!kfs || kfs.length < 2) return { rect: clip.rect };
  const local = t - clip.start;
  if (local <= kfs[0].at) return { rect: { ...kfs[0].rect } };
  for (let i = 1; i < kfs.length; i++) {
    const a = kfs[i - 1];
    const b = kfs[i];
    if (local <= b.at) {
      const span = b.at - a.at;
      if (span <= 1e-9) return { rect: { ...b.rect } };
      return { rect: lerpRect(a.rect, b.rect, (local - a.at) / span) };
    }
  }
  return { rect: { ...kfs[kfs.length - 1].rect } };
}

export interface SpeedSlice {
  /** source range held by this slice (seconds, within the media) */
  inStart: number;
  inEnd: number;
  /** constant speed (×) applied across the slice */
  speed: number;
  /** timeline offsets from `clip.start` (seconds) */
  tStart: number;
  tEnd: number;
}

/**
 * A clip's speed curve realised as constant-speed slices — the single source of
 * truth for the timeline integral, preview rate and export segmentation, so
 * what's previewed matches what's rendered. Returns null when there's no curve.
 */
export function speedSlices(clip: Clip, n = SPEED_CURVE_SLICES): SpeedSlice[] | null {
  const curve = clip.speedCurve;
  if (!curve) return null;
  const L = Math.max(0, clip.out - clip.in);
  const slices: SpeedSlice[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const u0 = i / n;
    const u1 = (i + 1) / n;
    const speed = Math.max(0.0001, evalSpeedAt(curve, (u0 + u1) / 2));
    const inStart = clip.in + u0 * L;
    const inEnd = clip.in + u1 * L;
    const dur = (inEnd - inStart) / speed;
    slices.push({ inStart, inEnd, speed, tStart: t, tEnd: t + dur });
    t += dur;
  }
  return slices;
}

export function clipTimelineDuration(clip: Clip): number {
  const slices = speedSlices(clip);
  if (slices) return slices.length ? slices[slices.length - 1].tEnd : 0;
  return Math.max(0, (clip.out - clip.in) / Math.max(0.0001, clip.speed));
}

/** Speed (×) being applied at timeline time `t`; 0 for a frozen (held) clip. */
export function clipSpeedAt(clip: Clip, t: number): number {
  if (clip.freeze != null) return 0;
  const slices = speedSlices(clip);
  if (!slices) return clip.speed;
  const local = t - clip.start;
  for (const sl of slices) if (local <= sl.tEnd) return sl.speed;
  return slices[slices.length - 1]?.speed ?? clip.speed;
}

export function clipEnd(clip: Clip): number {
  return clip.start + clipTimelineDuration(clip);
}

/** Length of the whole project timeline (latest clip end). */
export function projectDuration(clips: Clip[]): number {
  return clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
}

const MERGE_EPS = 1e-3;

/**
 * Whether the given clips can be joined into a single clip — the inverse of a
 * split. They must be 2+ clips sharing the same source media, track and speed,
 * and (in start order) each one must abut the next both in the source
 * (next.in == prev.out) and on the timeline (next.start == prev end), so the
 * result is one continuous source range with no gaps or overlaps.
 */
export function canMergeClips(clips: Clip[]): boolean {
  if (clips.length < 2) return false;
  const first = clips[0];
  if (!first.mediaId) return false; // text overlays have no source to join
  const uniform = clips.every(
    (c) =>
      c.mediaId === first.mediaId &&
      c.trackId === first.trackId &&
      Math.abs(c.speed - first.speed) < MERGE_EPS,
  );
  if (!uniform) return false;
  const ordered = [...clips].sort((a, b) => a.start - b.start);
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    if (Math.abs(cur.in - prev.out) > MERGE_EPS) return false;
    if (Math.abs(cur.start - clipEnd(prev)) > MERGE_EPS) return false;
  }
  return true;
}

/** Source-time inside a clip for a given timeline time. */
export function clipSourceAt(clip: Clip, t: number): number {
  if (clip.freeze != null) return clip.freeze;
  const slices = speedSlices(clip);
  if (slices) {
    const local = t - clip.start;
    if (local <= 0) return clip.in;
    if (local >= slices[slices.length - 1].tEnd) return clip.out;
    for (const sl of slices) {
      if (local <= sl.tEnd) {
        const p = sl.inStart + (local - sl.tStart) * sl.speed;
        return Math.min(sl.inEnd, Math.max(sl.inStart, p));
      }
    }
    return clip.out;
  }
  const s = clip.in + (t - clip.start) * clip.speed;
  return Math.min(clip.out, Math.max(clip.in, s));
}

export function isClipActiveAt(clip: Clip, t: number, epsilon = 0.001): boolean {
  return !clip.hidden && t >= clip.start - epsilon && t < clipEnd(clip) - epsilon;
}

/**
 * Audio fade multiplier (0..1) at timeline time `t` from the clip's fade-in/out,
 * so the preview ramps the volume the same way the export's `afade` does.
 */
export function audioFadeGain(clip: Clip, t: number): number {
  const dur = clipTimelineDuration(clip);
  if (dur <= 0) return 1;
  const into = t - clip.start;
  let g = 1;
  const fin = clip.fadeIn ?? 0;
  const fout = clip.fadeOut ?? 0;
  if (fin > 0 && into < fin) g = Math.min(g, into / fin);
  if (fout > 0 && into > dur - fout) g = Math.min(g, (dur - into) / fout);
  return Math.max(0, Math.min(1, g));
}

/** The clip immediately before `clip` on the same track (greatest start that is earlier), or undefined. */
export function prevClipOnTrack(clips: Clip[], clip: Clip): Clip | undefined {
  let best: Clip | undefined;
  for (const c of clips) {
    if (c.id === clip.id || c.trackId !== clip.trackId) continue;
    if (c.start < clip.start - 1e-6 && (!best || c.start > best.start)) best = c;
  }
  return best;
}

/** Largest valid transition (overlap) length for `clip`: bounded by both clips' lengths. */
export function maxTransitionDuration(clips: Clip[], clip: Clip): number {
  const prev = prevClipOnTrack(clips, clip);
  if (!prev) return 0;
  return Math.max(0, Math.min(clipTimelineDuration(prev), clipTimelineDuration(clip)) - MIN_CLIP);
}

/** Whether a transition can start `clip`: it needs an adjacent (or already overlapping) predecessor. */
export function canAddTransition(clips: Clip[], clip: Clip): boolean {
  if (clip.text || clip.audioOnly) return false;
  const prev = prevClipOnTrack(clips, clip);
  if (!prev || prev.text || prev.audioOnly) return false;
  return clipEnd(prev) >= clip.start - MIN_CLIP;
}

export interface TransitionRender {
  /** opacity multiplier for the incoming clip (0..1) at this time. */
  clipMul: number;
  /** solid dip color for fade transitions, or null. */
  dipColor: string | null;
  /** dip layer opacity (0..1). */
  dipOpacity: number;
  /** incoming-clip translation as a fraction of the canvas (slides). */
  offsetX: number;
  offsetY: number;
  /** CSS clip-path that reveals the incoming clip (wipes / iris), or null. */
  clipPath: string | null;
}

const NO_TRANSITION: TransitionRender = {
  clipMul: 1,
  dipColor: null,
  dipOpacity: 0,
  offsetX: 0,
  offsetY: 0,
  clipPath: null,
};

export type TransitionFamily = 'dissolve' | 'fade' | 'slide' | 'wipe' | 'iris';

/** Group a transition id into the family that decides how it animates. */
export function transitionFamily(type: TransitionId): TransitionFamily {
  if (type === 'fadeBlack' || type === 'fadeWhite') return 'fade';
  if (type === 'circleOpen') return 'iris';
  if (type === 'slideLeft' || type === 'slideRight' || type === 'slideUp' || type === 'slideDown') return 'slide';
  if (type === 'wipeLeft' || type === 'wipeRight' || type === 'wipeUp' || type === 'wipeDown') return 'wipe';
  return 'dissolve';
}

/**
 * How to render the incoming clip at time `t`. Dissolve ramps its opacity over
 * the overlap; fade types reveal it from under a color dip; slides translate it
 * in from an edge; wipes / iris reveal it behind a moving CSS clip-path. The
 * preview reads this directly and the export encodes the same shapes, so they
 * match.
 */
export function transitionRenderAt(clip: Clip, t: number): TransitionRender {
  const tr = clip.transition;
  if (!tr || tr.duration <= 0) return NO_TRANSITION;
  const p = (t - clip.start) / tr.duration;
  if (p < 0 || p > 1) return NO_TRANSITION;
  const fam = transitionFamily(tr.type);
  if (fam === 'dissolve') return { ...NO_TRANSITION, clipMul: p };
  if (fam === 'fade') {
    return {
      ...NO_TRANSITION,
      clipMul: Math.max(0, Math.min(1, (p - 0.5) * 2)),
      dipColor: tr.type === 'fadeWhite' ? '#ffffff' : '#000000',
      dipOpacity: 1 - Math.abs(2 * p - 1),
    };
  }
  if (fam === 'slide') {
    const r = clip.rect;
    const k = 1 - p;
    let offsetX = 0;
    let offsetY = 0;
    if (tr.type === 'slideRight') offsetX = -(r.x + r.w) * k;
    else if (tr.type === 'slideLeft') offsetX = (1 - r.x) * k;
    else if (tr.type === 'slideDown') offsetY = -(r.y + r.h) * k;
    else if (tr.type === 'slideUp') offsetY = (1 - r.y) * k;
    return { ...NO_TRANSITION, offsetX, offsetY };
  }
  // wipe / iris: reveal via a moving CSS clip-path.
  const k = 1 - p;
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  let clipPath: string;
  if (tr.type === 'wipeRight') clipPath = `inset(0 ${pct(k)} 0 0)`;
  else if (tr.type === 'wipeLeft') clipPath = `inset(0 0 0 ${pct(k)})`;
  else if (tr.type === 'wipeDown') clipPath = `inset(0 0 ${pct(k)} 0)`;
  else if (tr.type === 'wipeUp') clipPath = `inset(${pct(k)} 0 0 0)`;
  else clipPath = `circle(${(p * 70.71).toFixed(2)}% at 50% 50%)`;
  return { ...NO_TRANSITION, clipPath };
}

/**
 * Effective audio fade lengths for a clip, folding in transitions: an incoming
 * transition fades this clip's audio in over its overlap, and a transition on
 * the following clip fades this clip's audio out over that overlap, so the two
 * clips audibly cross-fade.
 */
export function transitionFades(clips: Clip[], clip: Clip): { fadeIn: number; fadeOut: number } {
  const inDur = clip.transition?.duration ?? 0;
  let outDur = 0;
  for (const c of clips) {
    if (c.trackId !== clip.trackId || !c.transition || c.start <= clip.start) continue;
    if (prevClipOnTrack(clips, c)?.id === clip.id) outDur = Math.max(outDur, c.transition.duration);
  }
  return {
    fadeIn: Math.max(clip.fadeIn ?? 0, inDur),
    fadeOut: Math.max(clip.fadeOut ?? 0, outDur),
  };
}

/** Candidate snap positions for a dragged clip: origin, playhead and every other clip edge. */
export function clipSnapTargets(clips: Clip[], excludeId: string, playhead: number): number[] {
  const targets = new Set<number>([0, playhead]);
  for (const c of clips) {
    if (c.id === excludeId) continue;
    targets.add(c.start);
    targets.add(clipEnd(c));
  }
  return [...targets];
}

/**
 * Snap a dragged clip's start so its nearest edge lands on a target within
 * `tolerance` seconds. Returns the original start when nothing is close enough.
 */
export function snapStart(start: number, dur: number, targets: number[], tolerance: number): number {
  let best = start;
  let bestDist = tolerance;
  for (const tgt of targets) {
    const dStart = Math.abs(start - tgt);
    if (dStart < bestDist) {
      bestDist = dStart;
      best = tgt;
    }
    const dEnd = Math.abs(start + dur - tgt);
    if (dEnd < bestDist) {
      bestDist = dEnd;
      best = Math.max(0, tgt - dur);
    }
  }
  return best;
}
