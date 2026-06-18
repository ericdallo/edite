import type {
  AspectMode,
  CropRect,
  ExportFormat,
  ExportQuality,
  Segment,
} from '@/types/editor';
import { sortSegments } from '@/lib/segments';

export interface ExportParams {
  segments: Segment[];
  speed: number;
  muted: boolean;
  hasAudio: boolean;
  crop: CropRect | null;
  /** target width/height, or null to keep current frame ratio. */
  aspectRatio: number | null;
  aspectMode: AspectMode;
  sourceWidth: number;
  sourceHeight: number;
  format: ExportFormat;
  quality: ExportQuality;
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

/** atempo only accepts 0.5..2.0; chain filters to reach an arbitrary factor. */
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
  return 'mp4';
}

function videoCrf(quality: ExportQuality, format: ExportFormat): string {
  if (format === 'webm') {
    return quality === 'high' ? '30' : quality === 'medium' ? '34' : '40';
  }
  return quality === 'high' ? '20' : quality === 'medium' ? '24' : '30';
}

/** Build the ffmpeg argument list from the current editor state. */
export function buildExportCommand(inputName: string, p: ExportParams): BuiltCommand {
  const segs = sortSegments(p.segments).filter((s) => s.end - s.start > 0.02);
  const safeSegs = segs.length > 0 ? segs : [{ id: 'all', start: 0, end: 0 }];
  const useAudio = !p.muted && p.hasAudio && p.format !== 'gif';

  const graph: string[] = [];

  // 1. Per-segment trims.
  safeSegs.forEach((s, i) => {
    graph.push(`[0:v]trim=start=${fmt(s.start)}:end=${fmt(s.end)},setpts=PTS-STARTPTS[v${i}]`);
    if (useAudio) {
      graph.push(`[0:a]atrim=start=${fmt(s.start)}:end=${fmt(s.end)},asetpts=PTS-STARTPTS[a${i}]`);
    }
  });

  // 2. Concat segments (or pass a single one through).
  let vcat = '[v0]';
  let acat = '[a0]';
  if (safeSegs.length > 1) {
    const inputs = safeSegs.map((_, i) => (useAudio ? `[v${i}][a${i}]` : `[v${i}]`)).join('');
    graph.push(
      `${inputs}concat=n=${safeSegs.length}:v=1:a=${useAudio ? 1 : 0}[vcat]${useAudio ? '[acat]' : ''}`,
    );
    vcat = '[vcat]';
    acat = '[acat]';
  }

  // 3. Video post-processing chain.
  const vf: string[] = [];
  let baseW = p.sourceWidth;
  let baseH = p.sourceHeight;

  if (p.crop) {
    const cw = makeEven(p.crop.width * p.sourceWidth);
    const ch = makeEven(p.crop.height * p.sourceHeight);
    const cx = Math.round(p.crop.x * p.sourceWidth);
    const cy = Math.round(p.crop.y * p.sourceHeight);
    vf.push(`crop=${cw}:${ch}:${cx}:${cy}`);
    baseW = cw;
    baseH = ch;
  }

  if (Math.abs(p.speed - 1) > 1e-3) {
    vf.push(`setpts=PTS/${p.speed}`);
  }

  if (p.aspectRatio) {
    const r = p.aspectRatio;
    if (p.aspectMode === 'fill') {
      vf.push(`crop='min(iw,ih*${r.toFixed(6)})':'min(ih,iw/${r.toFixed(6)})'`);
    } else {
      const cur = baseW / baseH;
      let cW: number;
      let cH: number;
      if (cur > r) {
        cH = baseH;
        cW = Math.round(baseH * r);
      } else {
        cW = baseW;
        cH = Math.round(baseW / r);
      }
      cW = makeEven(cW);
      cH = makeEven(cH);
      vf.push(
        `scale=${cW}:${cH}:force_original_aspect_ratio=decrease,pad=${cW}:${cH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`,
      );
    }
  }

  if (p.format === 'gif') {
    vf.push('fps=14,scale=480:-2:flags=lanczos');
  } else if (p.format === 'mp4') {
    // H.264 requires even dimensions; normalize after any crop.
    vf.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');
  }

  if (vf.length === 0) vf.push('null');
  graph.push(`${vcat}${vf.join(',')}[vout]`);

  // 4. Audio post-processing chain.
  if (useAudio) {
    const af: string[] = [];
    if (Math.abs(p.speed - 1) > 1e-3) af.push(atempoChain(p.speed));
    if (af.length === 0) af.push('anull');
    graph.push(`${acat}${af.join(',')}[aout]`);
  }

  // 5. Assemble arguments.
  const args: string[] = ['-i', inputName, '-filter_complex', graph.join(';'), '-map', '[vout]'];
  if (useAudio) args.push('-map', '[aout]');

  const crf = videoCrf(p.quality, p.format);
  if (p.format === 'mp4') {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-pix_fmt', 'yuv420p');
    if (useAudio) args.push('-c:a', 'aac', '-b:a', '160k');
    else args.push('-an');
    args.push('-movflags', '+faststart');
  } else if (p.format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', crf, '-row-mt', '1');
    if (useAudio) args.push('-c:a', 'libopus', '-b:a', '160k');
    else args.push('-an');
  } else {
    args.push('-an');
  }

  const outputName = `output.${p.format}`;
  args.push(outputName);
  return { args, outputName, mime: MIME[p.format] };
}
