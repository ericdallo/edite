/**
 * Audio waveform peaks for timeline rendering. Decoding is done once per media
 * (cached by id) with the WebAudio API and reduced to a fixed array of 0..1
 * amplitude peaks, which clips slice to their trimmed range. Fully local — the
 * bytes never leave the browser.
 */

/** Resolution of the cached peak array per media item. */
const WAVE_BUCKETS = 1200;

const cache = new Map<string, Promise<number[]>>();

type AudioCtor = typeof AudioContext;

function audioContextCtor(): AudioCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
  );
}

async function decodePeaks(blob: Blob): Promise<number[]> {
  const Ctor = audioContextCtor();
  if (!Ctor) throw new Error('Web Audio is not available.');
  const ctx = new Ctor();
  try {
    const buf = await blob.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const channel = audio.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / WAVE_BUCKETS));
    const peaks: number[] = [];
    let max = 0;
    for (let i = 0; i < WAVE_BUCKETS; i++) {
      let peak = 0;
      const base = i * block;
      for (let j = 0; j < block; j++) {
        const v = Math.abs(channel[base + j] || 0);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
      if (peak > max) max = peak;
    }
    // Normalize so the loudest part fills the height regardless of recording level.
    const norm = max > 1e-4 ? 1 / max : 1;
    return peaks.map((p) => p * norm);
  } finally {
    void ctx.close();
  }
}

/** Cached, normalized (0..1) waveform peaks for a media item. */
export function getWaveformPeaks(mediaId: string, blob: Blob): Promise<number[]> {
  let p = cache.get(mediaId);
  if (!p) {
    p = decodePeaks(blob).catch((e) => {
      cache.delete(mediaId); // let a later mount retry
      throw e;
    });
    cache.set(mediaId, p);
  }
  return p;
}

/**
 * Slice the full-media peaks to a source range and resample to `count` bars.
 * `from`/`to` are seconds within the media of total length `duration`.
 */
export function slicePeaks(peaks: number[], from: number, to: number, duration: number, count: number): number[] {
  if (peaks.length === 0 || count <= 0) return [];
  const dur = duration > 0 ? duration : 1;
  const a = Math.max(0, Math.min(1, from / dur));
  const b = Math.max(a, Math.min(1, to / dur));
  const startIdx = a * (peaks.length - 1);
  const endIdx = b * (peaks.length - 1);
  const span = Math.max(1e-6, endIdx - startIdx);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round(startIdx + (span * i) / Math.max(1, count - 1));
    out.push(peaks[Math.min(peaks.length - 1, Math.max(0, idx))] ?? 0);
  }
  return out;
}
