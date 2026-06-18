import type { Segment } from '@/types/editor';

export function sortSegments(segments: Segment[]): Segment[] {
  return [...segments].sort((a, b) => a.start - b.start);
}

/** Total duration of the edited result, in source-seconds (before speed change). */
export function outputDuration(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
}

export interface SourcePosition {
  sourceTime: number;
  segmentId: string;
  segmentIndex: number;
}

/** Map an output-timeline time to the matching source time + segment. */
export function outputToSource(segments: Segment[], outputTime: number): SourcePosition | null {
  const sorted = sortSegments(segments);
  if (sorted.length === 0) return null;
  let acc = 0;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const len = s.end - s.start;
    if (outputTime <= acc + len) {
      return { sourceTime: s.start + (outputTime - acc), segmentId: s.id, segmentIndex: i };
    }
    acc += len;
  }
  const last = sorted[sorted.length - 1];
  return { sourceTime: last.end, segmentId: last.id, segmentIndex: sorted.length - 1 };
}

/** Map a source time to its position on the output timeline, or null if removed. */
export function sourceToOutput(segments: Segment[], sourceTime: number): number | null {
  const sorted = sortSegments(segments);
  let acc = 0;
  for (const s of sorted) {
    if (sourceTime < s.start) return null;
    if (sourceTime <= s.end) return acc + (sourceTime - s.start);
    acc += s.end - s.start;
  }
  return null;
}

/** Find the kept segment that contains the given source time. */
export function segmentAtSource(segments: Segment[], sourceTime: number): Segment | null {
  const sorted = sortSegments(segments);
  for (const s of sorted) {
    if (sourceTime >= s.start && sourceTime <= s.end) return s;
  }
  return null;
}

/**
 * Given the current source time during playback, decide where the player should
 * be: continue (null), jump to the next kept segment, or stop at the very end.
 */
export function resolvePlayback(
  segments: Segment[],
  sourceTime: number,
  epsilon = 0.04,
): { action: 'continue' } | { action: 'seek'; to: number } | { action: 'end' } {
  const sorted = sortSegments(segments);
  if (sorted.length === 0) return { action: 'end' };

  for (const s of sorted) {
    if (sourceTime >= s.start - epsilon && sourceTime < s.end - epsilon) {
      return { action: 'continue' };
    }
  }
  // Not inside a segment: find the next segment starting after now.
  for (const s of sorted) {
    if (s.start > sourceTime + epsilon) {
      return { action: 'seek', to: s.start };
    }
  }
  return { action: 'end' };
}
