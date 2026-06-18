import type { ExportFormat, ExportQuality } from '@/types/editor';

export interface ExportClip {
  kind: 'video' | 'image';
  /** timeline position (s) */
  start: number;
  in: number;
  out: number;
  speed: number;
  /** placement on the output canvas, fractions 0..1 */
  rect: { x: number; y: number; w: number; h: number };
  opacity: number;
  hasAudio: boolean;
  muted: boolean;
}

export interface MultiExportParams {
  canvasW: number;
  canvasH: number;
  fps: number;
  duration: number;
  /** bottom -> top compositing order; input index == array index */
  clips: ExportClip[];
  format: ExportFormat;
  quality: ExportQuality;
  globalMuted: boolean;
}

export interface BuiltCommand {
  args: string[];
  outputName: string;
  mime: string;
}

const MIME: Record<ExportFormat, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  gif: 'image/gif',
};

function fmt(n: number): string {
  return n.toFixed(3);
}

function makeEven(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

function atempoChain(speed: number): string {
  const parts: string[] = [];
  let remaining = speed;
  while (remaining > 2 + 1e-6) {
    parts.push('atempo=2.0');
    remaining /= 2;
  }
  while (remaining < 0.5 - 1e-6) {
    parts.push('atempo=0.5');
    remaining /= 0.5;
  }
  parts.push(`atempo=${remaining.toFixed(5)}`);
  return parts.join(',');
}

export function extFromMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('matroska')) return 'mkv';
  if (mime.includes('x-msvideo') || mime.includes('avi')) return 'avi';
  if (mime.includes('ogg')) return 'ogv';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'mp4';
}

function videoCrf(quality: ExportQuality, format: ExportFormat): string {
  if (format === 'webm') return quality === 'high' ? '30' : quality === 'medium' ? '34' : '40';
  return quality === 'high' ? '20' : quality === 'medium' ? '24' : '30';
}

function timelineLen(c: ExportClip): number {
  return Math.max(0, (c.out - c.in) / Math.max(0.0001, c.speed));
}

/**
 * Build a compositing ffmpeg command: each clip is one input, scaled to its rect
 * and overlaid (bottom -> top) onto a canvas, enabled only during its time span.
 * Audio from each unmuted clip is delayed to its start and mixed.
 */
export function buildExportCommand(inputNames: string[], p: MultiExportParams): BuiltCommand {
  const { canvasW: W, canvasH: H, fps, duration } = p;
  const clips = p.clips;

  const inputArgs: string[] = [];
  clips.forEach((c, k) => {
    if (c.kind === 'image') {
      inputArgs.push('-loop', '1', '-framerate', String(fps), '-t', fmt(timelineLen(c)), '-i', inputNames[k]);
    } else {
      inputArgs.push('-i', inputNames[k]);
    }
  });

  const graph: string[] = [];
  graph.push(`color=c=black:s=${W}x${H}:r=${fps}:d=${fmt(duration)},format=yuv420p[bg]`);

  let acc = 'bg';
  clips.forEach((c, k) => {
    const rw = makeEven(c.rect.w * W);
    const rh = makeEven(c.rect.h * H);
    const x = Math.round(c.rect.x * W);
    const y = Math.round(c.rect.y * H);
    const cover = `scale=${rw}:${rh}:force_original_aspect_ratio=increase,crop=${rw}:${rh},setsar=1`;
    const op = c.opacity < 0.999 ? `,format=rgba,colorchannelmixer=aa=${c.opacity.toFixed(3)}` : '';
    // Shift each clip's PTS to its timeline start so overlay frames line up with
    // the enable window; without this the input reaches EOF early and the slot
    // renders black (e.g. the tail clip of a split).
    const delay = c.start > 1e-6 ? `+${fmt(c.start)}/TB` : '';
    if (c.kind === 'image') {
      const pts = delay ? `setpts=PTS-STARTPTS${delay},` : '';
      graph.push(`[${k}:v]${pts}${cover}${op}[c${k}]`);
    } else {
      const base = Math.abs(c.speed - 1) > 1e-3 ? `(PTS-STARTPTS)/${c.speed}` : 'PTS-STARTPTS';
      graph.push(`[${k}:v]trim=${fmt(c.in)}:${fmt(c.out)},setpts=${base}${delay},${cover}${op}[c${k}]`);
    }
    const end = c.start + timelineLen(c);
    // eof_action=repeat (not pass): once a clip's frames run out it holds its
    // last frame instead of exposing black for a frame at the junction; `enable`
    // still gates it off outside its window, so intentional gaps stay black.
    graph.push(
      `[${acc}][c${k}]overlay=${x}:${y}:enable='between(t,${fmt(c.start)},${fmt(end)})':eof_action=repeat[ov${k}]`,
    );
    acc = `ov${k}`;
  });
  graph.push(`[${acc}]${p.format === 'mp4' ? 'format=yuv420p' : 'null'}[vout]`);

  const useAudio = !p.globalMuted && p.format !== 'gif';
  const audioLabels: string[] = [];
  if (useAudio) {
    clips.forEach((c, k) => {
      if (c.kind !== 'video' || !c.hasAudio || c.muted) return;
      const ms = Math.round(c.start * 1000);
      const sp = Math.abs(c.speed - 1) > 1e-3 ? `,${atempoChain(c.speed)}` : '';
      graph.push(
        `[${k}:a]atrim=${fmt(c.in)}:${fmt(c.out)},asetpts=PTS-STARTPTS${sp},adelay=${ms}|${ms}[a${k}]`,
      );
      audioLabels.push(`[a${k}]`);
    });
    if (audioLabels.length > 0) {
      graph.push(
        `${audioLabels.join('')}amix=inputs=${audioLabels.length}:normalize=0:dropout_transition=0[aout]`,
      );
    }
  }
  const withAudio = audioLabels.length > 0;

  const args: string[] = [...inputArgs, '-filter_complex', graph.join(';'), '-map', '[vout]'];
  if (withAudio) args.push('-map', '[aout]');
  args.push('-t', fmt(duration));

  const crf = videoCrf(p.quality, p.format);
  if (p.format === 'mp4') {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-pix_fmt', 'yuv420p');
    if (withAudio) args.push('-c:a', 'aac', '-b:a', '160k');
    else args.push('-an');
    args.push('-movflags', '+faststart');
  } else if (p.format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', crf, '-row-mt', '1');
    if (withAudio) args.push('-c:a', 'libopus', '-b:a', '160k');
    else args.push('-an');
  } else {
    args.push('-an');
  }

  const outputName = `output.${p.format}`;
  args.push(outputName);
  return { args, outputName, mime: MIME[p.format] };
}
