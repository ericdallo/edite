/**
 * Pure mapping from Whisper output to caption clips on the timeline. Kept free
 * of any ML / DOM dependency so it is fully unit-testable: the transcriber
 * feeds raw timestamped segments in, this turns them into timeline-placed text
 * clips (offset by the source clip's position and scaled by its speed).
 */
import { MIN_CLIP } from '@/lib/constants';

/** A transcribed word, in seconds from the start of the transcribed audio window. */
export interface RawWord {
  text: string;
  start: number;
  end: number;
}

/** A transcribed segment, in seconds from the start of the transcribed audio window. */
export interface RawSegment {
  text: string;
  start: number;
  end: number;
  /** Per-word timings (same time frame as `start`/`end`), when available. */
  words?: RawWord[];
}

/** A caption ready to become a text clip: timeline `start`/`duration` (seconds) + text. */
export interface CaptionClip {
  start: number;
  duration: number;
  text: string;
  /** Per-word timings relative to this caption's start (seconds), when available. */
  words?: RawWord[];
}

/** How long each caption line should be. */
export type CaptionLength = 'word' | 'short' | 'line' | 'sentence';

export interface CaptionLengthOption {
  id: CaptionLength;
  label: string;
  hint: string;
}

export const CAPTION_LENGTH_OPTIONS: CaptionLengthOption[] = [
  { id: 'word', label: 'One word', hint: 'Karaoke-style, one word at a time' },
  { id: 'short', label: 'A few words', hint: 'Punchy, TikTok-style lines' },
  { id: 'line', label: 'One line', hint: 'A readable line at a time' },
  { id: 'sentence', label: 'Full sentence', hint: 'Whole sentences' },
];

/** Grouping limits for {@link groupWordsIntoLines}. A 0 disables that limit. */
export interface LineGroupOptions {
  /** soft max characters per line. */
  maxChars: number;
  /** max words per line. */
  maxWords: number;
  /** max line duration (seconds). */
  maxDuration: number;
  /** break the line when the silence before a word exceeds this (seconds). */
  maxGap: number;
}

/** Translate a caption-length choice into concrete grouping limits. */
export function lineOptionsFor(length: CaptionLength): LineGroupOptions {
  switch (length) {
    case 'word':
      return { maxChars: 0, maxWords: 1, maxDuration: 0, maxGap: 0 };
    case 'short':
      return { maxChars: 18, maxWords: 3, maxDuration: 2.5, maxGap: 0.7 };
    case 'sentence':
      return { maxChars: 0, maxWords: 0, maxDuration: 0, maxGap: 0 };
    case 'line':
    default:
      return { maxChars: 36, maxWords: 8, maxDuration: 5, maxGap: 0.8 };
  }
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

/** Round to millisecond precision (plenty for captions; avoids float noise). */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const SENTENCE_END = /[.!?…。！？]$/;

/**
 * Group word-level segments into short caption lines. A new line is started
 * when adding the next word would break any active limit (chars / words /
 * duration), when the silence before the word is longer than `maxGap`, or right
 * after a word that ends a sentence. Each produced segment carries the words it
 * spans so a later word-by-word highlight can use them.
 */
export function groupWordsIntoLines(words: RawSegment[], opts: LineGroupOptions): RawSegment[] {
  const lines: RawSegment[] = [];
  let cur: RawSegment | null = null;

  const flush = () => {
    if (cur && cur.text) lines.push(cur);
    cur = null;
  };

  for (const w of words) {
    const text = cleanCaptionText(w.text);
    if (!text) continue;

    if (cur) {
      const merged = `${cur.text} ${text}`;
      const overChars = opts.maxChars > 0 && merged.length > opts.maxChars;
      const overWords = opts.maxWords > 0 && (cur.words?.length ?? 0) >= opts.maxWords;
      const overDur = opts.maxDuration > 0 && w.end - cur.start > opts.maxDuration;
      const bigGap = opts.maxGap > 0 && w.start - cur.end > opts.maxGap;
      if (overChars || overWords || overDur || bigGap) flush();
    }

    if (!cur) {
      cur = { text, start: w.start, end: w.end, words: [{ text, start: w.start, end: w.end }] };
    } else {
      cur.text = `${cur.text} ${text}`;
      cur.end = w.end;
      cur.words!.push({ text, start: w.start, end: w.end });
    }

    if (SENTENCE_END.test(text)) flush();
  }
  flush();
  return lines;
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
      return { text, s, start: opts.clipStart + s / speed, end: opts.clipStart + e / speed, words: seg.words };
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
    if (duration < MIN_CLIP) continue;
    // Map each word into clip-relative timeline seconds (segment time `t` lands
    // at `(t - segStart) / speed` after the caption's own start), clamped to the
    // caption's trimmed window.
    const words = cur.words
      ?.map((w) => {
        const ws = clampRange(w.start, cur.s, opts.audioDuration);
        const we = clampRange(w.end, ws, opts.audioDuration);
        return {
          text: cleanCaptionText(w.text),
          start: round3(clampRange((ws - cur.s) / speed, 0, duration)),
          end: round3(clampRange((we - cur.s) / speed, 0, duration)),
        };
      })
      .filter((w) => w.text.length > 0);
    out.push(words && words.length ? { start: cur.start, duration, text: cur.text, words } : { start: cur.start, duration, text: cur.text });
  }
  return out;
}
