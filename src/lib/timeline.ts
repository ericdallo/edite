import type { Clip } from '@/types/editor';

export function clipTimelineDuration(clip: Clip): number {
  return Math.max(0, (clip.out - clip.in) / Math.max(0.0001, clip.speed));
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
  const s = clip.in + (t - clip.start) * clip.speed;
  return Math.min(clip.out, Math.max(clip.in, s));
}

export function isClipActiveAt(clip: Clip, t: number, epsilon = 0.001): boolean {
  return !clip.hidden && t >= clip.start - epsilon && t < clipEnd(clip) - epsilon;
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
