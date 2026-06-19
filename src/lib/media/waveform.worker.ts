/**
 * Off-thread waveform reduction. Collapses a media's first-channel samples into
 * a fixed array of normalized 0..1 peaks so the per-sample loop never runs on
 * the main thread. The samples buffer is transferred in by the caller.
 */

export type WaveformRequest = { id: number; samples: Float32Array; buckets: number };
export type WaveformResponse = { id: number; peaks: number[] };

function reduce(samples: Float32Array, buckets: number): number[] {
  const block = Math.max(1, Math.floor(samples.length / buckets));
  const peaks: number[] = [];
  let max = 0;
  for (let i = 0; i < buckets; i++) {
    let peak = 0;
    const base = i * block;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(samples[base + j] || 0);
      if (v > peak) peak = v;
    }
    peaks.push(peak);
    if (peak > max) max = peak;
  }
  // Normalize so the loudest part fills the height regardless of recording level.
  const norm = max > 1e-4 ? 1 / max : 1;
  return peaks.map((p) => p * norm);
}

self.addEventListener('message', (e: MessageEvent<WaveformRequest>) => {
  const { id, samples, buckets } = e.data;
  const res: WaveformResponse = { id, peaks: reduce(samples, buckets) };
  (self as unknown as Worker).postMessage(res);
});
