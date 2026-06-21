import { type FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg, onFFmpegLog, terminateFFmpeg } from './client';
import { buildExportCommand, extFromMime, type BuiltCommand, type MultiExportParams } from './command';
import { lutFileName, lutUrl } from '@/lib/lut';
import { renderTextToBlob } from '@/lib/text/raster';
import { renderShapeToBlob } from '@/lib/shape/raster';
import { renderFrameToBlob } from '@/lib/media/frame';
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
  /** raw `.cube` text for any imported (custom:) LUTs referenced by the clips. */
  luts?: { id: string; cube: string }[];
  /** repeat the rendered output N times (lossless concat); 1 or absent = once. */
  loop?: number;
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
  const lutNames: string[] = [];
  const logLines: string[] = [];
  let offLog: (() => void) | undefined;
  let built: BuiltCommand | undefined;
  let loopedName: string | undefined;
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

    // Each clip needs one input file: a media file, a rasterized text PNG, or a
    // frozen single-frame PNG decoded from its source video.
    const blobById = new Map(req.media.map((m) => [m.id, m.blob]));
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
      } else if (c.kind === 'shape' && c.shape) {
        const blob = await renderShapeToBlob(c.shape, c.rect, req.params.canvasW, req.params.canvasH);
        const name = `shp_${k}.png`;
        await ffmpeg.writeFile(name, await fetchFile(blob));
        inputNames.push(name);
        textNames.push(name);
      } else if (c.freeze != null) {
        const blob = blobById.get(req.clipMediaIds[k]);
        if (!blob) throw new Error('Missing source media for a freeze frame.');
        const png = await renderFrameToBlob(blob, c.freeze);
        const name = `frz_${k}.png`;
        await ffmpeg.writeFile(name, await fetchFile(png));
        inputNames.push(name);
        textNames.push(name);
      } else {
        inputNames.push(nameById.get(req.clipMediaIds[k]) ?? '');
      }
    }
    // Write any referenced LUT cubes into the FS so `lut3d` can read them: custom
    // (imported) ones come inline in the request, bundled ones are fetched.
    const lutIds = [...new Set(clips.map((c) => c.color?.lut).filter((id): id is string => !!id))];
    const customLuts = new Map((req.luts ?? []).map((l) => [l.id, l.cube]));
    for (const id of lutIds) {
      throwIfAborted();
      const name = lutFileName(id);
      const custom = customLuts.get(id);
      if (custom != null) {
        await ffmpeg.writeFile(name, new TextEncoder().encode(custom));
      } else {
        const url = lutUrl(id);
        if (!url) {
          logger.warn('no source for LUT', id);
          continue;
        }
        const res = await fetch(url);
        if (!res.ok) {
          logger.warn('failed to fetch LUT', id, res.status);
          continue;
        }
        await ffmpeg.writeFile(name, new Uint8Array(await res.arrayBuffer()));
      }
      lutNames.push(name);
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

    // Loop pass: repeat the rendered output N times losslessly (demuxer concat).
    // Skipped for GIF (it already loops on playback) and PNG (a still frame).
    let finalName = built.outputName;
    const loop = Math.max(1, Math.floor(req.loop ?? 1));
    if (loop > 1 && req.params.format !== 'gif' && req.params.format !== 'png') {
      loopedName = `looped.${req.params.format}`;
      logger.info(`looping output ${loop}x`);
      await ffmpeg.exec(['-stream_loop', String(loop - 1), '-i', built.outputName, '-c', 'copy', loopedName]);
      throwIfAborted();
      finalName = loopedName;
    }

    const data = await ffmpeg.readFile(finalName);
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
      for (const name of lutNames) await ffmpeg.deleteFile(name).catch(() => undefined);
      if (built) await ffmpeg.deleteFile(built.outputName).catch(() => undefined);
      if (loopedName) await ffmpeg.deleteFile(loopedName).catch(() => undefined);
    }
  }
}
