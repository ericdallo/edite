import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg } from './client';
import { buildExportCommand, extFromMime } from './command';

export type { ExportParams, BuiltCommand } from './command';
export { buildExportCommand } from './command';

export interface ExportRequest {
  blob: Blob;
  params: import('./command').ExportParams;
  onProgress?: (ratio: number) => void;
}

/** Run a full export in ffmpeg.wasm and return the resulting media blob. */
export async function runExport(req: ExportRequest): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const inputName = `input.${extFromMime(req.blob.type)}`;
  const built = buildExportCommand(inputName, req.params);

  await ffmpeg.writeFile(inputName, await fetchFile(req.blob));

  const handler = ({ progress }: { progress: number }) => {
    req.onProgress?.(Math.max(0, Math.min(1, progress)));
  };
  ffmpeg.on('progress', handler);
  try {
    await ffmpeg.exec(built.args);
  } finally {
    ffmpeg.off('progress', handler);
  }

  const data = await ffmpeg.readFile(built.outputName);
  await ffmpeg.deleteFile(inputName).catch(() => undefined);
  await ffmpeg.deleteFile(built.outputName).catch(() => undefined);

  const bytes = data as Uint8Array;
  // Copy into a standalone ArrayBuffer-backed view: ffmpeg may return an array
  // backed by a SharedArrayBuffer, which the Blob constructor's types reject.
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return new Blob([out], { type: built.mime });
}
