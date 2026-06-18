import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { logger } from '@/lib/log';

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

/**
 * Terminate the running ffmpeg worker — the only way to interrupt an in-flight
 * exec. Resets the singleton so the next getFFmpeg() loads a fresh instance.
 */
export function terminateFFmpeg(): void {
  if (!instance) return;
  try {
    instance.terminate();
    logger.info('ffmpeg terminated');
  } catch (e) {
    logger.warn('ffmpeg terminate failed', e);
  }
  instance = null;
  loadPromise = null;
}

export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const ffmpeg = new FFmpeg();
      ffmpeg.on('log', ({ message }) => {
        logger.ffmpeg(message);
        for (const handler of logHandlers) handler(message);
      });
      logger.info('loading ffmpeg core…');
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${BASE}ffmpeg/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${BASE}ffmpeg/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      logger.info('ffmpeg core loaded');
      instance = ffmpeg;
      return ffmpeg;
    } catch (e) {
      logger.error('failed to load ffmpeg core', e);
      loadPromise = null; // allow a later retry instead of caching the failure
      throw e;
    }
  })();

  return loadPromise;
}
