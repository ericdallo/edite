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
