import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export type LogHandler = (message: string) => void;

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
const logHandlers = new Set<LogHandler>();

// Single-thread core, served same-origin from /public/ffmpeg (copied in by
// scripts/copy-ffmpeg.mjs). No SharedArrayBuffer / COOP / COEP required, so it
// runs on GitHub Pages out of the box.
const BASE = import.meta.env.BASE_URL;

export function onFFmpegLog(handler: LogHandler): () => void {
  logHandlers.add(handler);
  return () => logHandlers.delete(handler);
}

export function isFFmpegLoaded(): boolean {
  return instance !== null;
}

export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => {
      for (const handler of logHandlers) handler(message);
    });
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${BASE}ffmpeg/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${BASE}ffmpeg/ffmpeg-core.wasm`, 'application/wasm'),
    ]);
    await ffmpeg.load({ coreURL, wasmURL });
    instance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}
