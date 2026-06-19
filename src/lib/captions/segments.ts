/**
 * Pure mapping from Whisper output to caption clips on the timeline. Kept free
 * of any ML / DOM dependency so it is fully unit-testable: the transcriber
 * feeds raw timestamped segments in, this turns them into timeline-placed text
 * clips (offset by the source clip's position and scaled by its speed).
 */
import { MIN_CLIP } from '@/lib/constants';

/** A transcribed segment, in seconds from the start of the transcribed audio window. */
export interface RawSegment {
  text: string;
  start: number;
  end: number;
}

/** A caption ready to become a text clip: timeline `start`/`duration` (seconds) + text. */
export interface CaptionClip {
  start: number;
  duration: number;
  text: string;
}

interface WhisperChunk {
  text?: string;
  timestamp?: [number, number | null] | null;
}

export interface WhisperOutput {
  text?: string;
  chunks?: WhisperChunk[];
}

/** Trim and collapse whitespace/newlines so a chunk renders as one tidy line. */
export function cleanCaptionText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize raw Whisper output into segments. Handles the open-ended final
 * chunk (`timestamp[1] === null`) by extending it to the audio's end, and falls
 * back to a single full-length segment when no chunk timestamps are present.
 */
export function parseWhisperChunks(output: WhisperOutput, audioDuration: number): RawSegment[] {
  const chunks = output.chunks ?? [];
  const segments: RawSegment[] = [];
  for (const chunk of chunks) {
    const text = cleanCaptionText(chunk.text ?? '');
    if (!text) continue;
    const ts = chunk.timestamp;
    const start = ts && typeof ts[0] === 'number' ? ts[0] : 0;
    const rawEnd = ts ? ts[1] : null;
    const end = typeof rawEnd === 'number' ? rawEnd : audioDuration;
    segments.push({ text, start, end });
  }
  if (segments.length === 0) {
    const text = cleanCaptionText(output.text ?? '');
    if (text) segments.push({ text, start: 0, end: audioDuration });
  }
  return segments;
}

function clampRange(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export interface CaptionMapOptions {
  /** timeline position of the source clip (seconds). */
  clipStart: number;
  /** source clip playback speed (segment times are divided by it). */
  speed: number;
  /** the source clip's on-timeline length (captions are clamped to this window). */
  clipDuration: number;
  /** length of the transcribed audio window (seconds). */
  audioDuration: number;
}

/**
 * Map transcribed segments onto the timeline as caption clips. Segment times
 * are relative to the transcribed window (0 = the clip's trimmed `in`), so a
 * time `s` lands at `clipStart + s / speed`. Captions are cleaned, dropped when
 * empty, clamped to the source clip's window, and trimmed so consecutive
 * captions never overlap (each ends no later than the next one starts).
 */
export function segmentsToCaptionClips(
  segments: RawSegment[],
  opts: CaptionMapOptions,
): CaptionClip[] {
  const speed = Math.max(0.0001, opts.speed);
  const windowEnd = opts.clipStart + Math.max(0, opts.clipDuration);
  const placed = segments
    .map((seg) => {
      const text = cleanCaptionText(seg.text);
      const s = clampRange(seg.start, 0, opts.audioDuration);
      const e = clampRange(seg.end, s, opts.audioDuration);
      return { text, start: opts.clipStart + s / speed, end: opts.clipStart + e / speed };
    })
    .filter((p) => p.text.length > 0 && p.start < windowEnd - MIN_CLIP)
    .sort((a, b) => a.start - b.start);

  const out: CaptionClip[] = [];
  for (let i = 0; i < placed.length; i++) {
    const cur = placed[i];
    const next = placed[i + 1];
    const limit = Math.min(windowEnd, next ? next.start : Number.POSITIVE_INFINITY);
    const end = Math.min(cur.end, limit);
    const duration = end - cur.start;
    if (duration >= MIN_CLIP) out.push({ start: cur.start, duration, text: cur.text });
  }
  return out;
}
