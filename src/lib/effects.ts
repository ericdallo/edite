import type { VideoEffects } from '@/types/editor';

const EPS = 1e-3;

/**
 * Shared sizing coefficients, expressed as a fraction of the clip frame so the
 * look is resolution-independent and preview matches export. Each side feeds the
 * same constant: the ffmpeg node (export) and the CSS/shader value (preview).
 */
const BLUR_K = 0.04; // gblur sigma / CSS blur radius, as a fraction of the min dimension
const PIXELATE_K = 0.12; // mosaic block size, as a fraction of the min dimension
const RGBSPLIT_K = 0.02; // channel shift, as a fraction of the frame width
const GRAIN_MAX = 60; // ffmpeg `noise` strength at amount 100
const GRAIN_AMP = 0.4; // shader grain amplitude (±) on 0..1 color at amount 100

export const EFFECT_KEYS = ['blur', 'pixelate', 'rgbSplit', 'grain'] as const;
export type EffectKey = (typeof EFFECT_KEYS)[number];

function clampNum(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** True when no effect is engaged (or the set is absent). */
export function isNeutralEffects(e?: VideoEffects | null): boolean {
  if (!e) return true;
  return EFFECT_KEYS.every((k) => (e[k] ?? 0) <= EPS);
}

/**
 * The three effects that preview through the WebGL clip shader (they resample or
 * add per-pixel noise). `blur` is excluded: it previews as a cheap CSS `blur()`.
 */
export function hasShaderEffects(e?: VideoEffects | null): boolean {
  if (!e) return false;
  return (e.pixelate ?? 0) > EPS || (e.rgbSplit ?? 0) > EPS || (e.grain ?? 0) > EPS;
}

/** Clamp every effect amount to 0..100, preserving which fields are present. */
export function clampEffects(e: VideoEffects): VideoEffects {
  const out: VideoEffects = {};
  for (const k of EFFECT_KEYS) {
    if (e[k] != null) out[k] = clampNum(e[k] as number, 0, 100);
  }
  return out;
}

/** True when two effect sets match within a small epsilon (absent = neutral). */
export function effectsEqual(a?: VideoEffects | null, b?: VideoEffects | null): boolean {
  return EFFECT_KEYS.every((k) => Math.abs((a?.[k] ?? 0) - (b?.[k] ?? 0)) < EPS);
}

/**
 * CSS `filter` fragment for the blur effect, or undefined when off. `minDimPx`
 * is the clip's displayed min dimension in screen px, so the blur radius is the
 * same fraction of the frame the export's `gblur` sigma uses.
 */
export function cssEffectsFilter(e: VideoEffects | null | undefined, minDimPx: number): string | undefined {
  const blur = (e?.blur ?? 0) / 100;
  if (blur <= EPS || minDimPx <= 0) return undefined;
  return `blur(${(blur * BLUR_K * minDimPx).toFixed(2)}px)`;
}

/**
 * The ffmpeg node chain for the static effects, applied after the grade + chroma
 * key. `frameW`/`frameH` are the clip's pixel size on the canvas, so block /
 * shift / blur scale with the clip the same way the preview does. Order matches
 * the preview: pixelate, RGB-split, grain, then blur last.
 */
export function ffmpegEffectsFilter(e: VideoEffects | null | undefined, frameW: number, frameH: number): string {
  if (!e) return '';
  const minDim = Math.min(frameW, frameH);
  const nodes: string[] = [];

  const pix = (e.pixelate ?? 0) / 100;
  if (pix > EPS) {
    const b = Math.max(2, Math.round(pix * PIXELATE_K * minDim));
    nodes.push(`pixelize=w=${b}:h=${b}`);
  }
  const rs = (e.rgbSplit ?? 0) / 100;
  if (rs > EPS) {
    const n = Math.max(1, Math.round(rs * RGBSPLIT_K * frameW));
    nodes.push(`rgbashift=rh=${n}:bh=${-n}`);
  }
  const gr = (e.grain ?? 0) / 100;
  if (gr > EPS) {
    nodes.push(`noise=alls=${Math.max(1, Math.round(gr * GRAIN_MAX))}:allf=t+u`);
  }
  const bl = (e.blur ?? 0) / 100;
  if (bl > EPS) {
    nodes.push(`gblur=sigma=${(bl * BLUR_K * minDim).toFixed(2)}`);
  }
  return nodes.join(',');
}

/** Shader-ready effect amounts; the WebGL preview maps these straight to uniforms. */
export interface EffectUniforms {
  /** pixelate strength 0..1 (the shader derives the block size from the texture). */
  pixelate: number;
  /** RGB-split sample offset in UV (already scaled by {@link RGBSPLIT_K}). */
  rgbSplit: number;
  /** grain amplitude (±) on 0..1 color. */
  grain: number;
}

/**
 * Convert {@link VideoEffects} into the numbers the preview clip shader needs for
 * the three shader-rendered effects (blur is handled by CSS, not here). Mirrors
 * {@link ffmpegEffectsFilter} so the live preview matches the export.
 */
export function effectUniforms(e?: VideoEffects | null): EffectUniforms {
  return {
    pixelate: (e?.pixelate ?? 0) / 100,
    rgbSplit: ((e?.rgbSplit ?? 0) / 100) * RGBSPLIT_K,
    grain: ((e?.grain ?? 0) / 100) * GRAIN_AMP,
  };
}
