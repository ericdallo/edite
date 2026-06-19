import { type ColorAdjust, NEUTRAL_COLOR } from '@/types/editor';

const EPS = 1e-3;

/** The optional, deeper-grade fields and their neutral (no-op) values. */
const EXTRA_NEUTRAL = {
  temperature: 0,
  tint: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  sharpen: 0,
  vignette: 0,
} as const;

type ExtraKey = keyof typeof EXTRA_NEUTRAL;
const EXTRA_KEYS = Object.keys(EXTRA_NEUTRAL) as ExtraKey[];

/** Valid range per optional grade field. */
const EXTRA_RANGE: Record<ExtraKey, [number, number]> = {
  temperature: [-100, 100],
  tint: [-100, 100],
  exposure: [-100, 100],
  highlights: [-100, 100],
  shadows: [-100, 100],
  sharpen: [0, 100],
  vignette: [0, 100],
};

function clampNum(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Clamp every grade field to its valid range, preserving which optional fields
 * are present (so a clip with only the legacy knobs stays a 4-field object).
 */
export function clampColor(c: ColorAdjust): ColorAdjust {
  const out: ColorAdjust = {
    brightness: clampNum(c.brightness, 0, 4),
    contrast: clampNum(c.contrast, 0, 4),
    saturation: clampNum(c.saturation, 0, 4),
    hue: clampNum(c.hue, -180, 180),
  };
  for (const k of EXTRA_KEYS) {
    if (c[k] != null) out[k] = clampNum(c[k] as number, EXTRA_RANGE[k][0], EXTRA_RANGE[k][1]);
  }
  if (c.intensity != null) out.intensity = clampNum(c.intensity, 0, 1);
  return out;
}

/** The grade strength (0 = original, 1 = full); absent means full. */
export function gradeIntensity(c?: ColorAdjust | null): number {
  return c?.intensity ?? 1;
}

/** True when a color adjustment leaves the image unchanged (or is absent). */
export function isNeutralColor(c?: ColorAdjust | null): boolean {
  if (!c) return true;
  // Intensity 0 dials the whole grade off, so the look is the original.
  if (gradeIntensity(c) <= EPS) return true;
  return (
    Math.abs(c.brightness - 1) < EPS &&
    Math.abs(c.contrast - 1) < EPS &&
    Math.abs(c.saturation - 1) < EPS &&
    Math.abs(c.hue) < EPS &&
    EXTRA_KEYS.every((k) => Math.abs((c[k] ?? 0) - EXTRA_NEUTRAL[k]) < EPS)
  );
}

/** True when two color adjustments match within a small epsilon (absent = neutral). */
export function colorEquals(a?: ColorAdjust | null, b?: ColorAdjust | null): boolean {
  const x = a ?? { brightness: 1, contrast: 1, saturation: 1, hue: 0 };
  const y = b ?? { brightness: 1, contrast: 1, saturation: 1, hue: 0 };
  return (
    Math.abs(x.brightness - y.brightness) < EPS &&
    Math.abs(x.contrast - y.contrast) < EPS &&
    Math.abs(x.saturation - y.saturation) < EPS &&
    Math.abs(x.hue - y.hue) < EPS &&
    Math.abs(gradeIntensity(x) - gradeIntensity(y)) < EPS &&
    EXTRA_KEYS.every((k) => Math.abs((x[k] ?? 0) - (y[k] ?? 0)) < EPS)
  );
}

/**
 * True when any of the deeper-grade fields (temperature, tint, exposure,
 * highlights, shadows, sharpen, vignette) is engaged. The preview routes these
 * clips through the WebGL grade shader, since CSS `filter` can't reproduce them;
 * legacy-only grades stay on the cheap CSS path.
 */
export function hasExtraGrade(c?: ColorAdjust | null): boolean {
  if (!c) return false;
  return EXTRA_KEYS.some((k) => Math.abs(c[k] ?? 0) > EPS);
}

/**
 * Whether the preview must grade this clip through the WebGL shader rather than
 * the CSS-filter path: any deeper field, or a partial intensity dialing back an
 * otherwise non-neutral grade (CSS can't blend toward the original).
 */
export function needsGradeShader(c?: ColorAdjust | null): boolean {
  return hasExtraGrade(c) || (gradeIntensity(c) < 1 - EPS && !isNeutralColor(c));
}

/**
 * CSS `filter` for the lightweight preview path (clips with only the legacy
 * brightness/contrast/saturation/hue knobs and no chroma), or undefined when
 * neutral. Clips using the deeper-grade fields go through the WebGL shader
 * instead; this string only ever covers the four knobs CSS can reproduce.
 */
export function cssColorFilter(c?: ColorAdjust | null): string | undefined {
  if (isNeutralColor(c)) return undefined;
  const v = c as ColorAdjust;
  const parts = [`brightness(${v.brightness})`, `contrast(${v.contrast})`, `saturate(${v.saturation})`];
  if (Math.abs(v.hue) > EPS) parts.push(`hue-rotate(${v.hue}deg)`);
  return parts.join(' ');
}

/**
 * Per-channel linear RGB gains from exposure + temperature + tint, combined into
 * one diagonal color matrix. Exposure is a multiply (±~1.5 stops); temperature
 * warms (R up / B down) or cools; tint pushes magenta (R,B up / G down) or green.
 * The exact same three numbers drive ffmpeg `colorchannelmixer` and the preview
 * shader's `rgb *= gain`, so the two stay pixel-aligned.
 */
export function channelGains(c: ColorAdjust): [number, number, number] {
  const tn = (c.temperature ?? 0) / 100;
  const ti = (c.tint ?? 0) / 100;
  const exp = Math.pow(2, ((c.exposure ?? 0) / 100) * 1.5);
  const r = exp * (1 + 0.2 * tn) * (1 + 0.1 * ti);
  const g = exp * (1 - 0.2 * ti);
  const b = exp * (1 - 0.2 * tn) * (1 + 0.1 * ti);
  return [Math.max(0, r), Math.max(0, g), Math.max(0, b)];
}

/**
 * Highlights/shadows expressed as the moved output values at input 0.25 (shadows)
 * and 0.75 (highlights) of a fixed-endpoint tone curve through 0/0, 0.5/0.5, 1/1.
 * Feeds ffmpeg `curves=all` and the shader's matching per-channel curve.
 */
export function tonePoints(c: ColorAdjust): { low: number; high: number } {
  const low = clampNum(0.25 + 0.25 * ((c.shadows ?? 0) / 100), 0, 1);
  const high = clampNum(0.75 + 0.25 * ((c.highlights ?? 0) / 100), 0, 1);
  return { low, high };
}

/**
 * Full ffmpeg grade chain, or '' when neutral. The legacy eq/hue node is emitted
 * exactly as before (so existing renders are byte-identical); the deeper fields
 * append, in canonical order, a `colorchannelmixer` (exposure/temp/tint), a
 * `curves` (highlights/shadows), a `vignette`, then an `unsharp` (sharpen). The
 * preview shader applies the same ops in the same order.
 */
export function ffmpegColorFilter(c?: ColorAdjust | null): string {
  if (isNeutralColor(c)) return '';
  const v = c as ColorAdjust;
  const nodes: string[] = [];

  if (
    Math.abs(v.brightness - 1) > EPS ||
    Math.abs(v.contrast - 1) > EPS ||
    Math.abs(v.saturation - 1) > EPS ||
    Math.abs(v.hue) > EPS
  ) {
    let eq = `eq=brightness=${(v.brightness - 1).toFixed(3)}:contrast=${v.contrast.toFixed(3)}:saturation=${v.saturation.toFixed(3)}`;
    if (Math.abs(v.hue) > EPS) eq += `,hue=h=${v.hue.toFixed(2)}`;
    nodes.push(eq);
  }

  const [gr, gg, gb] = channelGains(v);
  if (Math.abs(gr - 1) > EPS || Math.abs(gg - 1) > EPS || Math.abs(gb - 1) > EPS) {
    nodes.push(`colorchannelmixer=rr=${gr.toFixed(4)}:gg=${gg.toFixed(4)}:bb=${gb.toFixed(4)}`);
  }

  const { low, high } = tonePoints(v);
  if (Math.abs(low - 0.25) > EPS || Math.abs(high - 0.75) > EPS) {
    nodes.push(`curves=all='0/0 0.25/${low.toFixed(4)} 0.5/0.5 0.75/${high.toFixed(4)} 1/1'`);
  }

  const vig = (v.vignette ?? 0) / 100;
  if (vig > EPS) nodes.push(`vignette=a=${(vig * 1.4).toFixed(4)}`);

  const sharp = (v.sharpen ?? 0) / 100;
  if (sharp > EPS) nodes.push(`unsharp=5:5:${(sharp * 1.5).toFixed(3)}:5:5:0`);

  return nodes.join(',');
}

/** Shader-ready grade parameters; the WebGL preview maps these straight to uniforms. */
export interface GradeUniforms {
  /** legacy knobs (CSS-equivalent math, applied first). */
  brightness: number;
  contrast: number;
  saturation: number;
  /** hue rotation in radians. */
  hue: number;
  /** per-channel RGB gains (exposure + temperature + tint). */
  gain: [number, number, number];
  /** tone-curve output at input 0.25 / 0.75 (highlights/shadows). */
  toneLow: number;
  toneHigh: number;
  /** edge-darkening amount, 0..1. */
  vignette: number;
  /** unsharp-mask amount (matches the ffmpeg `unsharp` luma amount). */
  sharpen: number;
  /** grade strength, 0 (original) .. 1 (full), blended against the source. */
  intensity: number;
}

/**
 * Convert a {@link ColorAdjust} into the numbers the preview grade shader needs.
 * Mirrors {@link ffmpegColorFilter} so the live preview matches the export.
 */
export function gradeUniforms(c?: ColorAdjust | null): GradeUniforms {
  const v = c ?? NEUTRAL_COLOR;
  return {
    brightness: v.brightness,
    contrast: v.contrast,
    saturation: v.saturation,
    hue: (v.hue * Math.PI) / 180,
    gain: channelGains(v),
    ...tonePointsUniform(v),
    vignette: (v.vignette ?? 0) / 100,
    sharpen: ((v.sharpen ?? 0) / 100) * 1.5,
    intensity: gradeIntensity(v),
  };
}

function tonePointsUniform(c: ColorAdjust): { toneLow: number; toneHigh: number } {
  const { low, high } = tonePoints(c);
  return { toneLow: low, toneHigh: high };
}
