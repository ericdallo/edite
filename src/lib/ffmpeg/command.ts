import type { ColorAdjust, ExportFormat, ExportQuality, TextStyle } from '@/types/editor';
import { ffmpegColorFilter } from '@/lib/color';

export interface ExportClip {
  /** 'audio' = sound only, no video overlay (standalone audio or detached track). */
  kind: 'video' | 'image' | 'text' | 'audio';
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
  /** mirror horizontally */
  flipH: boolean;
  /** flip vertically */
  flipV: boolean;
  /** clockwise rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  /** linear audio gain (1 = original level). */
  volume: number;
  /** audio fade-in length, in timeline seconds. */
  fadeIn: number;
  /** audio fade-out length, in timeline seconds. */
  fadeOut: number;
  /** text overlay spec, present when kind === 'text' (rasterized to a PNG input). */
  text?: TextStyle;
  /** source-time (s) of a held still; when set the clip is rasterized to a frozen PNG input. */
  freeze?: number;
  /** per-clip color / filter adjustment, rendered as an eq + hue chain. */
  color?: ColorAdjust;
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
  /** output canvas background color (hex, e.g. #000000) */
  background: string;
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
  if (mime.startsWith('audio/')) {
    if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
    if (mime.includes('wav')) return 'wav';
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('flac')) return 'flac';
    if (mime.includes('aac')) return 'aac';
    if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
    if (mime.includes('webm')) return 'webm';
    return 'mp3';
  }
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

/** ffmpeg color literal from a #rrggbb hex (falls back to black). */
function colorArg(hex: string): string {
  const h = (hex || '').replace('#', '').trim();
  return /^[0-9a-fA-F]{6}$/.test(h) ? `0x${h}` : 'black';
}

/** Orientation filter chain (flips then rotation), trailing comma so it prefixes the scale. */
function orientFilters(c: ExportClip): string {
  const parts: string[] = [];
  if (c.flipH) parts.push('hflip');
  if (c.flipV) parts.push('vflip');
  const rot = (((Math.round((c.rotation || 0) / 90) * 90) % 360) + 360) % 360;
  if (rot === 90) parts.push('transpose=1');
  else if (rot === 270) parts.push('transpose=2');
  else if (rot === 180) parts.push('transpose=1,transpose=1');
  return parts.length > 0 ? `${parts.join(',')},` : '';
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
    // Text overlays are pre-rasterized to a PNG, so they're looped like images.
    if (c.kind === 'image' || c.kind === 'text') {
      inputArgs.push('-loop', '1', '-framerate', String(fps), '-t', fmt(timelineLen(c)), '-i', inputNames[k]);
    } else {
      inputArgs.push('-i', inputNames[k]);
    }
  });

  const graph: string[] = [];
  graph.push(`color=c=${colorArg(p.background)}:s=${W}x${H}:r=${fps}:d=${fmt(duration)},format=yuv420p[bg]`);

  let acc = 'bg';
  clips.forEach((c, k) => {
    // Audio-only clips contribute no video layer; they're handled in the audio graph.
    if (c.kind === 'audio') return;
    const rw = makeEven(c.rect.w * W);
    const rh = makeEven(c.rect.h * H);
    const x = Math.round(c.rect.x * W);
    const y = Math.round(c.rect.y * H);
    const cover = `scale=${rw}:${rh}:force_original_aspect_ratio=increase,crop=${rw}:${rh},setsar=1`;
    const colorF = ffmpegColorFilter(c.color);
    const color = colorF ? `,${colorF}` : '';
    const op = c.opacity < 0.999 ? `,format=rgba,colorchannelmixer=aa=${c.opacity.toFixed(3)}` : '';
    // Shift each clip's PTS to its timeline start so overlay frames line up with
    // the enable window; without this the input reaches EOF early and the slot
    // renders black (e.g. the tail clip of a split).
    const delay = c.start > 1e-6 ? `+${fmt(c.start)}/TB` : '';
    const orient = orientFilters(c);
    if (c.kind === 'image' || c.kind === 'text') {
      const pts = delay ? `setpts=PTS-STARTPTS${delay},` : '';
      graph.push(`[${k}:v]${pts}${orient}${cover}${color}${op}[c${k}]`);
    } else {
      const base = Math.abs(c.speed - 1) > 1e-3 ? `(PTS-STARTPTS)/${c.speed}` : 'PTS-STARTPTS';
      graph.push(`[${k}:v]trim=${fmt(c.in)}:${fmt(c.out)},setpts=${base}${delay},${orient}${cover}${color}${op}[c${k}]`);
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
      // Both real video clips and audio-only clips carry sound.
      if ((c.kind !== 'video' && c.kind !== 'audio') || !c.hasAudio || c.muted) return;
      const ms = Math.round(c.start * 1000);
      const sp = Math.abs(c.speed - 1) > 1e-3 ? `,${atempoChain(c.speed)}` : '';
      const gain = c.volume ?? 1;
      const vol = Math.abs(gain - 1) > 1e-3 ? `,volume=${gain.toFixed(3)}` : '';
      // Fades are in timeline seconds, applied over the clip's post-speed length.
      const len = timelineLen(c);
      const fin = c.fadeIn ?? 0;
      const fout = c.fadeOut ?? 0;
      const fadeIn = fin > 1e-3 ? `,afade=t=in:st=0:d=${fmt(fin)}` : '';
      const fadeOut = fout > 1e-3 ? `,afade=t=out:st=${fmt(Math.max(0, len - fout))}:d=${fmt(fout)}` : '';
      graph.push(
        `[${k}:a]atrim=${fmt(c.in)}:${fmt(c.out)},asetpts=PTS-STARTPTS${sp}${vol}${fadeIn}${fadeOut},adelay=${ms}|${ms}[a${k}]`,
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
