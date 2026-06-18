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
