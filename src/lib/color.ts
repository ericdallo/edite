import type { ColorAdjust } from '@/types/editor';

const EPS = 1e-3;

/** True when a color adjustment leaves the image unchanged (or is absent). */
export function isNeutralColor(c?: ColorAdjust | null): boolean {
  if (!c) return true;
  return (
    Math.abs(c.brightness - 1) < EPS &&
    Math.abs(c.contrast - 1) < EPS &&
    Math.abs(c.saturation - 1) < EPS &&
    Math.abs(c.hue) < EPS
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
    Math.abs(x.hue - y.hue) < EPS
  );
}

/**
 * CSS `filter` value for the live preview, or undefined when neutral. CSS
 * contrast/saturate map 1:1 onto ffmpeg eq; brightness is a multiply and hue is
 * a rotation, matching `ffmpegColorFilter` as closely as the two engines allow.
 */
export function cssColorFilter(c?: ColorAdjust | null): string | undefined {
  if (isNeutralColor(c)) return undefined;
  const v = c as ColorAdjust;
  const parts = [`brightness(${v.brightness})`, `contrast(${v.contrast})`, `saturate(${v.saturation})`];
  if (Math.abs(v.hue) > EPS) parts.push(`hue-rotate(${v.hue}deg)`);
  return parts.join(' ');
}

/**
 * ffmpeg filter chain matching `cssColorFilter`, or '' when neutral. CSS
 * contrast/saturate map straight onto eq; CSS brightness (a multiply) is
 * approximated by eq's additive brightness (b - 1); hue-rotate becomes hue=h.
 */
export function ffmpegColorFilter(c?: ColorAdjust | null): string {
  if (isNeutralColor(c)) return '';
  const v = c as ColorAdjust;
  const eq = `eq=brightness=${(v.brightness - 1).toFixed(3)}:contrast=${v.contrast.toFixed(3)}:saturation=${v.saturation.toFixed(3)}`;
  const hue = Math.abs(v.hue) > EPS ? `,hue=h=${v.hue.toFixed(2)}` : '';
  return eq + hue;
}
