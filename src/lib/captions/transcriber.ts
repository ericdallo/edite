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
  isEnglishOnly,
  whisperLanguageName,
  whisperRepo,
  type CaptionModelId,
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

type Device = 'webgpu' | 'wasm';
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
  progressCallback: (info: ProgressInfo) => void,
): Promise<AsrPipe> {
  const key = `${repo}|${device}`;
  if (cache?.key === key) return cache.pipe;
  const { pipeline, env } = await import('@huggingface/transformers');
  // Remote models only (we never ship local weights); cache them in the browser.
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  const pipe = (await pipeline('automatic-speech-recognition', repo, {
    device,
    dtype: 'q8',
    progress_callback: progressCallback,
  })) as unknown as AsrPipe;
  cache = { key, pipe };
  return pipe;
}

/**
 * Transcribe 16 kHz mono PCM into timestamped segments. Tries WebGPU first and
 * transparently retries on WASM if the GPU path fails (build or inference).
 */
export async function transcribe(
  samples: Float32Array,
  opts: TranscribeOptions,
): Promise<RawSegment[]> {
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
  const callOptions: Record<string, unknown> = {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    ...(language ? { language, task: 'transcribe' } : {}),
  };

  const run = async (device: Device): Promise<unknown> => {
    const pipe = await getPipe(repo, device, progressCallback);
    opts.onProgress?.({ stage: 'transcribing', progress: 0 });
    return pipe(samples, callOptions);
  };

  const wantGpu = webgpuAvailable();
  let output: unknown;
  try {
    output = await run(wantGpu ? 'webgpu' : 'wasm');
  } catch (err) {
    if (!wantGpu) throw err;
    logger.warn('webgpu transcription failed, retrying on wasm', err);
    files.clear();
    output = await run('wasm');
  }

  opts.onProgress?.({ stage: 'transcribing', progress: 1 });
  const single = (Array.isArray(output) ? output[0] : output) as WhisperOutput;
  return parseWhisperChunks(single, audioDuration);
}
