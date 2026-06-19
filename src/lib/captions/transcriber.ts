/**
 * On-device speech-to-text via Transformers.js (Whisper). The heavy library is
 * loaded with a dynamic import so it stays in its own lazy chunk — nothing ships
 * in the main bundle until the user actually generates captions. Runs on WebGPU
 * when available and falls back to single-thread WASM, so it works on GitHub
 * Pages without cross-origin isolation. The audio never leaves the browser; the
 * one network touch is the one-time model download (cached afterwards).
 */
import type { ProgressInfo } from '@huggingface/transformers';
import { logger } from '@/lib/log';
import {
  dtypeForModel,
  isEnglishOnly,
  whisperLanguageName,
  whisperRepo,
  type CaptionModelId,
  type WhisperDtype,
} from './models';
import { parseWhisperChunks, type RawSegment, type WhisperOutput } from './segments';

const SAMPLE_RATE = 16000;

export type TranscribeStage = 'loading' | 'transcribing';

export interface TranscribeProgress {
  stage: TranscribeStage;
  /** 0..1 within the stage. */
  progress: number;
}

export interface TranscribeOptions {
  model: CaptionModelId;
  /** language code from the UI, or 'auto'. */
  language: string;
  onProgress?: (p: TranscribeProgress) => void;
}

export interface TranscribeResult {
  /** Word-level segments when `wordLevel`, otherwise sentence-level segments. */
  segments: RawSegment[];
  /** Whether `segments` carry usable per-word timings (to be grouped into lines). */
  wordLevel: boolean;
}

type Device = 'webgpu' | 'wasm';
type Timestamps = 'word' | true;
type AsrPipe = (audio: Float32Array, options?: Record<string, unknown>) => Promise<unknown>;

let cache: { key: string; pipe: AsrPipe } | null = null;

function webgpuAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { gpu?: unknown }).gpu != null
  );
}

async function getPipe(
  repo: string,
  device: Device,
  dtype: WhisperDtype,
  progressCallback: (info: ProgressInfo) => void,
): Promise<AsrPipe> {
  const key = `${repo}|${device}|${dtype}`;
  if (cache?.key === key) return cache.pipe;
  const { pipeline, env } = await import('@huggingface/transformers');
  // Remote models only (we never ship local weights); cache them in the browser.
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  const pipe = (await pipeline('automatic-speech-recognition', repo, {
    device,
    dtype,
    progress_callback: progressCallback,
  })) as unknown as AsrPipe;
  cache = { key, pipe };
  return pipe;
}

function asSingle(output: unknown): WhisperOutput {
  return (Array.isArray(output) ? output[0] : output) as WhisperOutput;
}

/** Number of distinct word start times (rounded to 10 ms) — 1 means degenerate. */
function distinctStarts(segments: RawSegment[]): number {
  return new Set(segments.map((s) => Math.round(s.start * 100))).size;
}

/**
 * Transcribe 16 kHz mono PCM into segments. Asks for word-level timestamps so
 * captions can be split into short, speech-synced lines; if the model returns
 * unusable word timings (a known Whisper quirk on some inputs) it falls back to
 * sentence-level timing. Tries WebGPU first and retries on WASM if the GPU path
 * fails.
 */
export async function transcribe(
  samples: Float32Array,
  opts: TranscribeOptions,
): Promise<TranscribeResult> {
  const repo = whisperRepo(opts.model, isEnglishOnly(opts.language));
  const audioDuration = samples.length / SAMPLE_RATE;

  // Aggregate per-file download progress into a single 0..1 ratio.
  const files = new Map<string, { loaded: number; total: number }>();
  const report = () => {
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    opts.onProgress?.({ stage: 'loading', progress: total > 0 ? Math.min(1, loaded / total) : 0 });
  };
  const progressCallback = (info: ProgressInfo) => {
    if (info.status === 'progress' && typeof info.total === 'number' && info.total > 0) {
      files.set(info.file, { loaded: info.loaded, total: info.total });
      report();
    }
  };

  const language = whisperLanguageName(opts.language);
  const baseOptions: Record<string, unknown> = {
    chunk_length_s: 30,
    stride_length_s: 5,
    ...(language ? { language, task: 'transcribe' } : {}),
  };

  let usedDevice: Device = webgpuAvailable() ? 'webgpu' : 'wasm';
  const run = async (device: Device, timestamps: Timestamps): Promise<unknown> => {
    const pipe = await getPipe(repo, device, dtypeForModel(opts.model, device), progressCallback);
    usedDevice = device;
    opts.onProgress?.({ stage: 'transcribing', progress: 0 });
    return pipe(samples, { ...baseOptions, return_timestamps: timestamps });
  };

  const attempt = async (timestamps: Timestamps): Promise<unknown> => {
    const wantGpu = webgpuAvailable();
    try {
      return await run(wantGpu ? 'webgpu' : 'wasm', timestamps);
    } catch (err) {
      if (!wantGpu) throw err;
      logger.warn('webgpu transcription failed, retrying on wasm', err);
      files.clear();
      return run('wasm', timestamps);
    }
  };

  const wordOut = asSingle(await attempt('word'));
  const wordSegments = parseWhisperChunks(wordOut, audioDuration);
  const chunkCount = wordOut.chunks?.length ?? 0;
  opts.onProgress?.({ stage: 'transcribing', progress: 1 });

  // Good word timings: hand them off to be grouped into lines.
  if (chunkCount > 1 && distinctStarts(wordSegments) > 1) {
    return { segments: wordSegments, wordLevel: true };
  }
  // The model gave no per-chunk breakdown — it's already one sentence-ish blob.
  if (chunkCount <= 1) {
    return { segments: wordSegments, wordLevel: false };
  }
  // Word timings came back degenerate; re-run for sentence-level timing on the
  // device that just worked.
  logger.warn('word-level timestamps unusable, falling back to sentence timing');
  files.clear();
  const sentenceOut = asSingle(await run(usedDevice, true));
  opts.onProgress?.({ stage: 'transcribing', progress: 1 });
  return { segments: parseWhisperChunks(sentenceOut, audioDuration), wordLevel: false };
}
