import { type FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg, onFFmpegLog, terminateFFmpeg } from './client';
import { buildExportCommand, extFromMime, type BuiltCommand, type MultiExportParams } from './command';
import { renderTextToBlob } from '@/lib/text/raster';
import { logger } from '@/lib/log';

export type { MultiExportParams, ExportClip, BuiltCommand } from './command';
export { buildExportCommand } from './command';

export interface ExportMedia {
  id: string;
  blob: Blob;
}

/** Thrown when an export is interrupted via its AbortSignal. */
export class ExportCancelledError extends Error {
  constructor() {
    super('Export canceled');
    this.name = 'ExportCancelledError';
  }
}

export interface ExportRequest {
  params: MultiExportParams;
  /** unique media used by the clips */
  media: ExportMedia[];
  /** media id for each clip, in the same order as params.clips */
  clipMediaIds: string[];
  onProgress?: (ratio: number) => void;
  /** abort to cancel: terminates the ffmpeg worker mid-render */
  signal?: AbortSignal;
}

/**
 * Detect whether a written file has an audio stream. Uses a tiny one-frame pass
 * to the null muxer so ffmpeg exits 0 (keeping the wasm instance reusable) while
 * still logging the input stream info we parse.
 */
async function hasAudioStream(ffmpeg: FFmpeg, name: string): Promise<boolean> {
  let log = '';
  const off = onFFmpegLog((m) => {
    log += `${m}\n`;
  });
  try {
    await ffmpeg.exec(['-hide_banner', '-i', name, '-frames:v', '1', '-f', 'null', 'probe.null']);
  } catch (e) {
    logger.warn('audio probe errored for', name, e);
  }
  off();
  await ffmpeg.deleteFile('probe.null').catch(() => undefined);
  const has = /Stream #\d+:\d+.*Audio:/i.test(log);
  logger.info(`audio for ${name}:`, has ? 'present' : 'none');
  return has;
}

/** Composite + render the multi-track project in ffmpeg.wasm. */
export async function runExport(req: ExportRequest): Promise<Blob> {
  const { signal } = req;
  if (signal?.aborted) throw new ExportCancelledError();

  logger.info('export starting', {
    clips: req.params.clips.length,
    media: req.media.length,
    format: req.params.format,
    quality: req.params.quality,
    canvas: `${req.params.canvasW}x${req.params.canvasH}`,
    fps: req.params.fps,
    duration: Number(req.params.duration.toFixed(2)),
    globalMuted: req.params.globalMuted,
  });

  const ffmpeg = await getFFmpeg();
  const throwIfAborted = () => {
    if (signal?.aborted) throw new ExportCancelledError();
  };
  const onAbort = () => terminateFFmpeg();
  signal?.addEventListener('abort', onAbort);

  const nameById = new Map<string, string>();
  const textNames: string[] = [];
  const logLines: string[] = [];
  let offLog: (() => void) | undefined;
  let built: BuiltCommand | undefined;
  const handler = ({ progress }: { progress: number }) => {
    req.onProgress?.(Math.max(0, Math.min(1, progress)));
  };
  ffmpeg.on('progress', handler);

  try {
    for (const m of req.media) {
      throwIfAborted();
      const name = `in_${m.id}.${extFromMime(m.blob.type)}`;
      nameById.set(m.id, name);
      await ffmpeg.writeFile(name, await fetchFile(m.blob));
      logger.info(`wrote ${name} (${(m.blob.size / 1024 / 1024).toFixed(1)} MB, ${m.blob.type || 'unknown'})`);
    }

    const audioByMedia = new Map<string, boolean>();
    for (const m of req.media) {
      throwIfAborted();
      audioByMedia.set(m.id, await hasAudioStream(ffmpeg, nameById.get(m.id)!));
    }

    const clips = req.params.clips.map((c, k) => ({
      ...c,
      hasAudio: c.hasAudio && (audioByMedia.get(req.clipMediaIds[k]) ?? false),
    }));

    // Each clip needs one input file: a media file, or a freshly rasterized text PNG.
    const inputNames: string[] = [];
    for (let k = 0; k < clips.length; k++) {
      throwIfAborted();
      const c = clips[k];
      if (c.kind === 'text' && c.text) {
        const blob = await renderTextToBlob(c.text, c.rect, req.params.canvasW, req.params.canvasH);
        const name = `txt_${k}.png`;
        await ffmpeg.writeFile(name, await fetchFile(blob));
        inputNames.push(name);
        textNames.push(name);
      } else {
        inputNames.push(nameById.get(req.clipMediaIds[k]) ?? '');
      }
    }
    built = buildExportCommand(inputNames, { ...req.params, clips });
    logger.info('ffmpeg command:\n' + ['ffmpeg', ...built.args].join(' '));

    offLog = onFFmpegLog((m) => {
      logLines.push(m);
      if (logLines.length > 200) logLines.shift();
    });

    throwIfAborted();
    await ffmpeg.exec(built.args);
    throwIfAborted();
    const data = await ffmpeg.readFile(built.outputName);
    const bytes = data as Uint8Array;
    const out = new Uint8Array(bytes.byteLength);
    out.set(bytes);
    logger.info(`export done: ${(out.byteLength / 1024 / 1024).toFixed(2)} MB`);
    return new Blob([out], { type: built.mime });
  } catch (err) {
    if (signal?.aborted || err instanceof ExportCancelledError) {
      logger.info('export canceled');
      throw new ExportCancelledError();
    }
    logger.error('export failed:', err);
    logger.error('full ffmpeg log:\n' + logLines.join('\n'));
    const cause = logLines.find((l) =>
      /no streams|invalid|error|unable|failed|not found|conversion failed|out of memory/i.test(l),
    );
    throw new Error(cause ? cause.trim() : err instanceof Error ? err.message : 'Export failed.');
  } finally {
    signal?.removeEventListener('abort', onAbort);
    offLog?.();
    ffmpeg.off('progress', handler);
    // Skip FS cleanup when aborted: the worker is gone and the next export
    // starts from a freshly loaded instance with a clean filesystem.
    if (!signal?.aborted) {
      for (const name of nameById.values()) await ffmpeg.deleteFile(name).catch(() => undefined);
      for (const name of textNames) await ffmpeg.deleteFile(name).catch(() => undefined);
      if (built) await ffmpeg.deleteFile(built.outputName).catch(() => undefined);
    }
  }
}
