/**
 * Extract a mono, 16 kHz PCM Float32Array from a media blob over a source-time
 * range, ready to feed Whisper. Fully local: decoding uses the Web Audio API
 * (the same path the waveform renderer relies on) and the bytes never leave the
 * browser. 16 kHz mono is exactly what Whisper expects.
 */

const TARGET_RATE = 16000;

type AudioCtor = typeof AudioContext;
type OfflineCtor = typeof OfflineAudioContext;

function audioContextCtor(): AudioCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
}

function offlineContextCtor(): OfflineCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: OfflineCtor }).webkitOfflineAudioContext
  );
}

/** Source-time range (seconds) to extract from the media. */
export interface AudioRange {
  in: number;
  out: number;
}

/**
 * Decode `blob`, slice the `[in, out]` source range, downmix to mono and
 * resample to 16 kHz. Returns the PCM samples (length = seconds * 16000).
 */
export async function decodeClipAudio(blob: Blob, range: AudioRange): Promise<Float32Array> {
  const Ctor = audioContextCtor();
  if (!Ctor) throw new Error('Web Audio is not available in this browser.');

  const ctx = new Ctor();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ctx.close();
  }

  const srcRate = decoded.sampleRate;
  const from = Math.max(0, Math.min(range.in, decoded.duration));
  const to = Math.max(from, Math.min(range.out, decoded.duration));
  const startSample = Math.floor(from * srcRate);
  const frames = Math.max(0, Math.floor(to * srcRate) - startSample);
  if (frames === 0) return new Float32Array(0);

  // Downmix every channel into one, scaled so the sum stays in range.
  const channels = decoded.numberOfChannels;
  const mono = new Float32Array(frames);
  for (let c = 0; c < channels; c++) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < frames; i++) mono[i] += data[startSample + i] / channels;
  }

  if (srcRate === TARGET_RATE) return mono;

  const Offline = offlineContextCtor();
  if (!Offline) {
    // No resampler available: better to transcribe at the source rate (Whisper
    // resamples internally) than to fail outright.
    return mono;
  }

  const outFrames = Math.max(1, Math.round((frames / srcRate) * TARGET_RATE));
  const offline = new Offline(1, outFrames, TARGET_RATE);
  const buffer = offline.createBuffer(1, frames, srcRate);
  buffer.copyToChannel(mono, 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}
