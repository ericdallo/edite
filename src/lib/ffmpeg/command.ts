import { isAudioFormat, TEXT_ANIM_OFFSET, textAnimUnit } from '@/types/editor';
import type { BlendMode, ChromaKey, ColorAdjust, ExportFormat, ExportQuality, Keyframe, ShapeStyle, TextAnim, TextStyle, Transition, TransitionId, VideoEffects } from '@/types/editor';
import { ffmpegColorFilter } from '@/lib/color';
import { ffmpegEffectsFilter } from '@/lib/effects';
import { lutFileName } from '@/lib/lut';
import { ffmpegChromaFilter } from '@/lib/chroma';
import { ffmpegBlendMode } from '@/lib/blend';
import { transitionFamily } from '@/lib/timeline';
import { keyframeExport } from './keyframes';

export interface ExportClip {
  /** 'audio' = sound only, no video overlay (standalone audio or detached track). */
  kind: 'video' | 'image' | 'text' | 'shape' | 'audio';
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
  /** play backwards (video `reverse` + audio `areverse`). */
  reversed?: boolean;
  /** linear audio gain (1 = original level). */
  volume: number;
  /** audio fade-in length, in timeline seconds. */
  fadeIn: number;
  /** audio fade-out length, in timeline seconds. */
  fadeOut: number;
  /** text overlay spec, present when kind === 'text' (rasterized to a PNG input). */
  text?: TextStyle;
  /** enter/exit animation for a text overlay (alpha + position over the in/out ramps). */
  textAnim?: TextAnim;
  /** vector shape spec, present when kind === 'shape' (rasterized to a PNG input). */
  shape?: ShapeStyle;
  /** source-time (s) of a held still; when set the clip is rasterized to a frozen PNG input. */
  freeze?: number;
  /** per-clip color / filter adjustment, rendered as an eq + hue chain. */
  color?: ColorAdjust;
  /** chroma key (green-screen removal), rendered as a chromakey filter. */
  chromaKey?: ChromaKey;
  /** static effects (blur/pixelate/RGB-split/grain), applied after grade + key. */
  effects?: VideoEffects;
  /** blend mode against the layers below (absent = normal `overlay`). */
  blendMode?: BlendMode;
  /** synthetic blurred-cover background layer (base clip scaled to fill + `gblur`). */
  bgBlur?: boolean;
  /** transition INTO this clip (cross-dissolve / color dip) over its leading overlap. */
  transition?: Transition;
  /** position + scale keyframes; when 2+ the clip is animated via `t` expressions. */
  keyframes?: Keyframe[];
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
  /** audio bitrate in kbps (AAC for MP4, Opus for WebM). */
  audioBitrate: number;
  /** optional target video bitrate in kbps; when > 0 it overrides the CRF preset. */
  videoBitrate?: number;
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
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
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
 * A geq alpha mask that reveals the layer over the overlap for a wipe / iris,
 * multiplied by the layer's own alpha so opacity still composes. Each option
 * value is single-quoted so its commas are safe in the filtergraph, and the
 * mask is gated to the overlap with `enable` so it's free outside it. Mirrors
 * the CSS clip-path the preview uses (`transitionRenderAt`).
 */
function wipeMask(type: TransitionId, start: number, dur: number): string {
  const prog = `clip((T-${fmt(start)})/${fmt(dur)},0,1)`;
  let cond: string;
  if (type === 'wipeRight') cond = `lte(X,W*${prog})`;
  else if (type === 'wipeLeft') cond = `gte(X,W*(1-${prog}))`;
  else if (type === 'wipeDown') cond = `lte(Y,H*${prog})`;
  else if (type === 'wipeUp') cond = `gte(Y,H*(1-${prog}))`;
  else cond = `lte(hypot(X-W/2,Y-H/2),hypot(W/2,H/2)*${prog})`; // circleOpen / iris
  return `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*${cond}':enable='between(t,${fmt(start)},${fmt(start + dur)})'`;
}

/**
 * Append each unmuted clip's audio (trim, speed, volume, fades, then delayed to
 * its timeline start) plus an amix of them all to the graph. Returns whether an
 * [aout] label was produced (false when nothing carries sound).
 */
function pushAudioMix(graph: string[], clips: ExportClip[]): boolean {
  const labels: string[] = [];
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
    const arev = c.reversed ? 'areverse,' : '';
    graph.push(
      `[${k}:a]atrim=${fmt(c.in)}:${fmt(c.out)},${arev}asetpts=PTS-STARTPTS${sp}${vol}${fadeIn}${fadeOut},adelay=${ms}|${ms}[a${k}]`,
    );
    labels.push(`[a${k}]`);
  });
  if (labels.length > 0) {
    graph.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0[aout]`);
  }
  return labels.length > 0;
}

/**
 * Build an audio-only export (MP3 / WAV): mix every clip's audio and drop video.
 * One input is added per clip so the `[k:a]` labels stay aligned with the clip
 * indices, exactly like the video path.
 */
function buildAudioOnlyCommand(inputNames: string[], p: MultiExportParams): BuiltCommand {
  const inputArgs: string[] = [];
  p.clips.forEach((_, k) => inputArgs.push('-i', inputNames[k]));

  const graph: string[] = [];
  const withAudio = pushAudioMix(graph, p.clips);

  const args: string[] = [...inputArgs];
  if (withAudio) args.push('-filter_complex', graph.join(';'), '-map', '[aout]');
  args.push('-t', fmt(p.duration), '-vn');

  if (p.format === 'mp3') args.push('-c:a', 'libmp3lame', '-b:a', `${Math.max(32, Math.round(p.audioBitrate || 192))}k`);
  else args.push('-c:a', 'pcm_s16le');

  const outputName = `output.${p.format}`;
  args.push(outputName);
  return { args, outputName, mime: MIME[p.format] };
}

/**
 * Build a compositing ffmpeg command: each clip is one input, scaled to its rect
 * and overlaid (bottom -> top) onto a canvas, enabled only during its time span.
 * Audio from each unmuted clip is delayed to its start and mixed.
 */
export function buildExportCommand(inputNames: string[], p: MultiExportParams): BuiltCommand {
  if (isAudioFormat(p.format)) return buildAudioOnlyCommand(inputNames, p);
  const { canvasW: W, canvasH: H, fps, duration } = p;
  const clips = p.clips;

  const inputArgs: string[] = [];
  clips.forEach((c, k) => {
    // Text overlays are pre-rasterized to a PNG, so they're looped like images.
    if (c.kind === 'image' || c.kind === 'text' || c.kind === 'shape') {
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
    // Animated transform: cover-crop once at the largest size (the box keeps its
    // aspect across keyframes), then a uniform per-frame downscale, so the
    // export reproduces the preview's object-cover exactly. Position is animated
    // on the overlay below. Both encode the same piecewise-linear function the
    // preview reads from clipTransformAt.
    const kf = c.keyframes && c.keyframes.length >= 2 ? keyframeExport(c.keyframes, W, H, c.start) : null;
    const cover = kf
      ? `scale=${kf.refW}:${kf.refH}:force_original_aspect_ratio=increase,crop=${kf.refW}:${kf.refH},setsar=1,scale=w='${kf.w}':h='${kf.h}':eval=frame`
      : `scale=${rw}:${rh}:force_original_aspect_ratio=increase,crop=${rw}:${rh},setsar=1`;
    // A LUT look applies after the knobs (lut3d reads a .cube the runner writes
    // into the FS); it joins the grade chain so the intensity blend dials it too.
    const lutNode = c.color?.lut ? `lut3d=${lutFileName(c.color.lut)}` : '';
    const colorF = [ffmpegColorFilter(c.color), lutNode].filter(Boolean).join(',');
    const color = colorF ? `,${colorF}` : '';
    // Grade strength: when < 1 the grade is rendered on a split branch and blended
    // back over the original, matching the preview shader's mix(orig, graded, i).
    const intensity = c.color?.intensity ?? 1;
    const blendGrade = colorF !== '' && intensity < 1 - 1e-3;
    const chromaF = ffmpegChromaFilter(c.chromaKey);
    const chroma = chromaF ? `,${chromaF}` : '';
    // Static effects ride after the grade + key, sized off the clip's frame so
    // the block/shift/blur scale with the clip exactly like the preview shader.
    const effF = ffmpegEffectsFilter(c.effects, rw, rh);
    const fx = effF ? `,${effF}` : '';
    const op = c.opacity < 0.999 ? `,format=rgba,colorchannelmixer=aa=${c.opacity.toFixed(3)}` : '';
    // Transition INTO this clip, by family: dissolve ramps alpha over the whole
    // overlap; fade reveals it in the second half (a color dip below covers the
    // first); wipe / iris reveal it behind a moving geq alpha mask; slides move
    // the overlay position (handled below, not here). `t`/`T` are timeline
    // seconds once the PTS is shifted.
    const tr = c.transition && c.transition.duration > 1e-3 ? c.transition : undefined;
    const fam = tr ? transitionFamily(tr.type) : null;
    let trans = '';
    if (tr && fam === 'dissolve') {
      trans = `,format=rgba,fade=t=in:st=${fmt(c.start)}:d=${fmt(tr.duration)}:alpha=1`;
    } else if (tr && fam === 'fade') {
      const hd = tr.duration / 2;
      trans = `,format=rgba,fade=t=in:st=${fmt(c.start + hd)}:d=${fmt(hd)}:alpha=1`;
    } else if (tr && (fam === 'wipe' || fam === 'iris')) {
      trans = `,${wipeMask(tr.type, c.start, tr.duration)}`;
    }
    // Shift each clip's PTS to its timeline start so overlay frames line up with
    // the enable window; without this the input reaches EOF early and the slot
    // renders black (e.g. the tail clip of a split).
    const delay = c.start > 1e-6 ? `+${fmt(c.start)}/TB` : '';
    const orient = orientFilters(c);
    // Text overlay enter/exit animation: an alpha fade in/out plus a box-offset
    // for slides, over the in/out ramps. Mirrors timeline.textAnimAt.
    let taFade = '';
    let tadx = '';
    let tady = '';
    if (c.kind === 'text' && c.textAnim && (c.textAnim.in || c.textAnim.out)) {
      const d = Math.min(c.textAnim.duration, timelineLen(c) / 2);
      if (d > 1e-3) {
        const tend = c.start + timelineLen(c);
        const fades: string[] = [];
        if (c.textAnim.in) fades.push(`fade=t=in:st=${fmt(c.start)}:d=${fmt(d)}:alpha=1`);
        if (c.textAnim.out) fades.push(`fade=t=out:st=${fmt(tend - d)}:d=${fmt(d)}:alpha=1`);
        taFade = `,format=rgba,${fades.join(',')}`;
        if (c.textAnim.in) {
          const u = textAnimUnit(c.textAnim.in);
          const decay = `(1-clip((t-${fmt(c.start)})/${fmt(d)},0,1))`;
          if (u.ux) tadx += `+(${fmt(u.ux * TEXT_ANIM_OFFSET * rw)})*${decay}`;
          if (u.uy) tady += `+(${fmt(u.uy * TEXT_ANIM_OFFSET * rh)})*${decay}`;
        }
        if (c.textAnim.out) {
          const u = textAnimUnit(c.textAnim.out);
          const grow = `clip((t-${fmt(tend - d)})/${fmt(d)},0,1)`;
          if (u.ux) tadx += `+(${fmt(-u.ux * TEXT_ANIM_OFFSET * rw)})*${grow}`;
          if (u.uy) tady += `+(${fmt(-u.uy * TEXT_ANIM_OFFSET * rh)})*${grow}`;
        }
      }
    }
    const tail = `${chroma}${fx}${op}${trans}${taFade}`;
    // Emit the clip's video chain from its pre-color `head`. Without an intensity
    // dial it's one linear statement (unchanged); with one, the grade runs on a
    // split branch and is blended over the original at the chosen strength.
    const emit = (head: string) => {
      if (!blendGrade) {
        graph.push(`[${k}:v]${head}${color}${tail}[c${k}]`);
        return;
      }
      graph.push(`[${k}:v]${head},format=rgba,split=2[sb${k}][sg${k}]`);
      graph.push(`[sg${k}]${colorF},format=rgba[gd${k}]`);
      graph.push(`[sb${k}][gd${k}]blend=all_expr='A*${fmt(1 - intensity)}+B*${fmt(intensity)}'[bl${k}]`);
      graph.push(tail ? `[bl${k}]${tail}[c${k}]` : `[bl${k}]null[c${k}]`);
    };
    // The synthetic blurred-background layer is the base clip scaled to cover the
    // whole canvas (rect is full) and softened; it composites first (bottom) so
    // fitted clips and their bars sit over it.
    const blur = c.bgBlur ? `,gblur=sigma=${Math.max(6, Math.round(Math.min(W, H) / 50))}` : '';
    if (c.kind === 'image' || c.kind === 'text' || c.kind === 'shape') {
      const pts = delay ? `setpts=PTS-STARTPTS${delay},` : '';
      emit(`${pts}${orient}${cover}${blur}`);
    } else {
      const base = Math.abs(c.speed - 1) > 1e-3 ? `(PTS-STARTPTS)/${c.speed}` : 'PTS-STARTPTS';
      const rev = c.reversed ? 'reverse,' : '';
      emit(`trim=${fmt(c.in)}:${fmt(c.out)},${rev}setpts=${base}${delay},${orient}${cover}${blur}`);
    }
    // A fade-to-color transition: a solid dip between the previous clip (already
    // in the accumulator) and this one, peaking opaque at the overlap midpoint.
    if (tr && fam === 'fade') {
      const hd = tr.duration / 2;
      const ov0 = c.start;
      const ov1 = c.start + tr.duration;
      const dipColor = tr.type === 'fadeWhite' ? 'white' : 'black';
      graph.push(
        `color=c=${dipColor}:s=${W}x${H}:r=${fps}:d=${fmt(duration)},format=rgba,fade=t=in:st=${fmt(ov0)}:d=${fmt(hd)}:alpha=1,fade=t=out:st=${fmt(ov0 + hd)}:d=${fmt(hd)}:alpha=1[dip${k}]`,
      );
      graph.push(`[${acc}][dip${k}]overlay=0:0:enable='between(t,${fmt(ov0)},${fmt(ov1)})'[ovd${k}]`);
      acc = `ovd${k}`;
    }
    const end = c.start + timelineLen(c);
    // eof_action=repeat (not pass): once a clip's frames run out it holds its
    // last frame instead of exposing black for a frame at the junction; `enable`
    // still gates it off outside its window, so intentional gaps stay black.
    // Slides add an offset to the overlay position over the overlap (composing
    // with any keyframe position); it decays to 0 by the end of the transition.
    let sdx = '';
    let sdy = '';
    if (tr && fam === 'slide') {
      const dk = `(1-clip((t-${fmt(c.start)})/${fmt(tr.duration)},0,1))`;
      if (tr.type === 'slideRight') sdx = `+(${fmt(-(c.rect.x + c.rect.w) * W)})*${dk}`;
      else if (tr.type === 'slideLeft') sdx = `+(${fmt((1 - c.rect.x) * W)})*${dk}`;
      else if (tr.type === 'slideDown') sdy = `+(${fmt(-(c.rect.y + c.rect.h) * H)})*${dk}`;
      else if (tr.type === 'slideUp') sdy = `+(${fmt((1 - c.rect.y) * H)})*${dk}`;
    }
    const baseX = kf ? kf.x : `${x}`;
    const baseY = kf ? kf.y : `${y}`;
    const pos =
      kf || sdx || sdy || tadx || tady
        ? `x='${baseX}${sdx}${tadx}':y='${baseY}${sdy}${tady}':eval=frame`
        : `${x}:${y}`;
    if (c.blendMode) {
      // `overlay` only does normal compositing, so a blend mode needs a detour:
      // drop the clip onto a transparent full-frame layer at the same (animated)
      // position, `blend` that against the canvas with the chosen mode, then
      // re-apply the clip's own alpha as a mask so only the clip's pixels — and
      // only inside its time window — are affected. Mirrors the preview's CSS
      // mix-blend-mode on the clip's layer.
      const mode = ffmpegBlendMode(c.blendMode);
      const win = `enable='between(t,${fmt(c.start)},${fmt(end)})'`;
      graph.push(`color=c=black@0:s=${W}x${H}:r=${fps}:d=${fmt(duration)},format=rgba[tr${k}]`);
      graph.push(`[tr${k}][c${k}]overlay=${pos}:eof_action=repeat[cf${k}]`);
      graph.push(`[cf${k}]split[cfa${k}][cfb${k}]`);
      graph.push(`[${acc}]split[ba${k}][bb${k}]`);
      // `blend` needs planar RGB (gbrp); on packed rgba it produces wrong colours.
      graph.push(`[ba${k}]format=gbrp[bp${k}]`);
      graph.push(`[cfa${k}]format=gbrp[cp${k}]`);
      graph.push(`[bp${k}][cp${k}]blend=all_mode=${mode}[bd${k}]`);
      graph.push(`[cfb${k}]alphaextract[am${k}]`);
      graph.push(`[bd${k}][am${k}]alphamerge[mb${k}]`);
      graph.push(`[bb${k}][mb${k}]overlay=0:0:${win}:eof_action=repeat[ov${k}]`);
    } else {
      graph.push(
        `[${acc}][c${k}]overlay=${pos}:enable='between(t,${fmt(c.start)},${fmt(end)})':eof_action=repeat[ov${k}]`,
      );
    }
    acc = `ov${k}`;
  });
  if (p.format === 'gif') {
    // Generate a palette from the whole clip and apply it, instead of ffmpeg's
    // default per-frame 256-color quantisation: much better color fidelity and
    // smaller files. Done in one graph via split (palettegen buffers frames).
    graph.push(
      `[${acc}]split[gsrc][gen];[gen]palettegen=stats_mode=diff[pal];[gsrc][pal]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle[vout]`,
    );
  } else {
    graph.push(`[${acc}]${p.format === 'mp4' ? 'format=yuv420p' : 'null'}[vout]`);
  }

  const useAudio = !p.globalMuted && p.format !== 'gif';
  const withAudio = useAudio ? pushAudioMix(graph, clips) : false;

  const args: string[] = [...inputArgs, '-filter_complex', graph.join(';'), '-map', '[vout]'];
  if (withAudio) args.push('-map', '[aout]');
  args.push('-t', fmt(duration));

  const crf = videoCrf(p.quality, p.format);
  const abr = `${Math.max(32, Math.round(p.audioBitrate || 160))}k`;
  const vbr = p.videoBitrate && p.videoBitrate > 0 ? `${Math.round(p.videoBitrate)}k` : null;
  if (p.format === 'mp4') {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p');
    if (vbr) args.push('-b:v', vbr, '-maxrate', vbr, '-bufsize', `${Math.round((p.videoBitrate ?? 0) * 2)}k`);
    else args.push('-crf', crf);
    if (withAudio) args.push('-c:a', 'aac', '-b:a', abr);
    else args.push('-an');
    args.push('-movflags', '+faststart');
  } else if (p.format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-row-mt', '1');
    if (vbr) args.push('-b:v', vbr);
    else args.push('-b:v', '0', '-crf', crf);
    if (withAudio) args.push('-c:a', 'libopus', '-b:a', abr);
    else args.push('-an');
  } else {
    args.push('-an');
  }

  const outputName = `output.${p.format}`;
  args.push(outputName);
  return { args, outputName, mime: MIME[p.format] };
}
