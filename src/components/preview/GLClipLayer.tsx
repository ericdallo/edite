import { type CSSProperties, useEffect, useRef } from 'react';
import type { ChromaKey, ColorAdjust, VideoEffects } from '@/types/editor';
import { gradeUniforms } from '@/lib/color';
import { effectUniforms } from '@/lib/effects';
import { lutUrl, packLut, parseCube } from '@/lib/lut';
import { hexToRgb01 } from '@/lib/chroma';

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2((a_pos.x + 1.0) * 0.5, (1.0 - a_pos.y) * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// One pass that mirrors the export's per-clip chain: the legacy knobs in
// CSS-equivalent math (so the look is unchanged), then exposure/temp/tint as a
// channel gain, a highlights/shadows tone curve, vignette and an unsharp mask,
// and finally — matching ffmpeg's color->chromakey order — the chroma key on the
// graded color. Output is premultiplied so keyed edges composite cleanly.
const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec3 u_bcs;     // brightness, contrast, saturation
uniform float u_hue;    // radians
uniform vec3 u_gain;    // per-channel gain (exposure + temperature + tint)
uniform vec2 u_tone;    // tone-curve output at input 0.25 / 0.75
uniform float u_vig;    // vignette 0..1
uniform float u_sharpen;
uniform float u_intensity; // grade strength 0..1
uniform vec2 u_texel;   // 1/width, 1/height
uniform float u_pixelate; // mosaic strength 0..1 (block derived from texture size)
uniform float u_rgbsplit; // channel sample offset in UV
uniform float u_grain;    // grain amplitude (±) on 0..1 color
uniform float u_seed;     // per-frame grain seed
uniform float u_chroma; // 1 = key enabled
uniform vec3 u_key;
uniform float u_sim;
uniform float u_blend;
uniform sampler2D u_lut; // packed 3D LUT (size blue-slices across)
uniform float u_lutSize;
uniform float u_hasLut;
varying vec2 v_uv;

const vec3 LUM = vec3(0.213, 0.715, 0.072);

// Trilinear sample of the packed LUT: bilinear red/green inside a blue slice
// (hardware LINEAR), blended manually between the two nearest blue slices.
vec3 sampleLut(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  float n = u_lutSize;
  float W = n * n;
  float bf = c.b * (n - 1.0);
  float b0 = floor(bf);
  float fb = bf - b0;
  float b1 = min(b0 + 1.0, n - 1.0);
  float uR = c.r * (n - 1.0) + 0.5;
  float v = (c.g * (n - 1.0) + 0.5) / n;
  vec3 s0 = texture2D(u_lut, vec2((b0 * n + uR) / W, v)).rgb;
  vec3 s1 = texture2D(u_lut, vec2((b1 * n + uR) / W, v)).rgb;
  return mix(s0, s1, fb);
}

vec2 rgb2uv(vec3 c) {
  float u = -0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b + 0.5;
  float v = 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b + 0.5;
  return vec2(u, v);
}

// Cheap hash noise for film grain; the seed shifts it every frame so the grain
// shimmers like the export's temporal noise filter (a look-alike, not a bit-match).
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233)) + u_seed) * 43758.5453);
}

// SVG/CSS hue-rotate matrix (column-major for GLSL's mat3 * vec3).
mat3 hueMat(float a) {
  float c = cos(a);
  float s = sin(a);
  vec3 c0 = vec3(0.213 + c * 0.787 - s * 0.213, 0.213 - c * 0.213 + s * 0.143, 0.213 - c * 0.213 - s * 0.787);
  vec3 c1 = vec3(0.715 - c * 0.715 - s * 0.715, 0.715 + c * 0.285 + s * 0.140, 0.715 - c * 0.715 + s * 0.715);
  vec3 c2 = vec3(0.072 - c * 0.072 + s * 0.928, 0.072 - c * 0.072 - s * 0.283, 0.072 + c * 0.928 + s * 0.072);
  return mat3(c0, c1, c2);
}

// Fixed-endpoint tone curve through 0/0, 0.5/0.5, 1/1 with the 0.25 and 0.75
// points moved to u_tone; triangular weights match the ffmpeg curves shape.
float tone(float x) {
  float wLow = max(0.0, 1.0 - abs(x - 0.25) / 0.25);
  float wHigh = max(0.0, 1.0 - abs(x - 0.75) / 0.25);
  return x + (u_tone.x - 0.25) * wLow + (u_tone.y - 0.75) * wHigh;
}

void main() {
  // Static effects that resample the source come first (mosaic block snap, then
  // a per-channel split), mirroring ffmpeg's pixelize/rgbashift; the grade then
  // runs on the sampled colour and grain is added after the key (see below).
  vec2 uv = v_uv;
  if (u_pixelate > 0.0) {
    vec2 texSize = vec2(1.0 / u_texel.x, 1.0 / u_texel.y);
    float block = max(1.0, u_pixelate * 0.12 * min(texSize.x, texSize.y));
    vec2 cell = block * u_texel;
    uv = (floor(uv / cell) + 0.5) * cell;
  }
  vec4 src;
  if (u_rgbsplit > 0.0) {
    vec2 o = vec2(u_rgbsplit, 0.0);
    float r = texture2D(u_tex, uv + o).r;
    vec4 mid = texture2D(u_tex, uv);
    float b = texture2D(u_tex, uv - o).b;
    src = vec4(r, mid.g, b, mid.a);
  } else {
    src = texture2D(u_tex, uv);
  }
  vec3 rgb = src.rgb;

  // Unsharp detail from the raw neighbourhood, re-added after grading.
  vec3 detail = vec3(0.0);
  if (u_sharpen > 0.0) {
    vec3 blur = (
      texture2D(u_tex, uv + vec2(u_texel.x, 0.0)).rgb +
      texture2D(u_tex, uv - vec2(u_texel.x, 0.0)).rgb +
      texture2D(u_tex, uv + vec2(0.0, u_texel.y)).rgb +
      texture2D(u_tex, uv - vec2(0.0, u_texel.y)).rgb) * 0.25;
    detail = rgb - blur;
  }

  rgb *= u_bcs.x;                       // brightness (multiply)
  rgb = (rgb - 0.5) * u_bcs.y + 0.5;    // contrast (around mid-grey)
  float l = dot(rgb, LUM);
  rgb = mix(vec3(l), rgb, u_bcs.z);     // saturation
  rgb = hueMat(u_hue) * rgb;            // hue rotation
  rgb *= u_gain;                        // exposure + temperature + tint
  rgb = clamp(rgb, 0.0, 1.0);
  rgb = vec3(tone(rgb.r), tone(rgb.g), tone(rgb.b)); // highlights/shadows
  rgb += u_sharpen * detail;            // sharpen

  if (u_vig > 0.0) {
    float r = length(v_uv - 0.5) * 1.41421356;
    rgb *= 1.0 - u_vig * smoothstep(0.35, 1.0, r);
  }
  rgb = clamp(rgb, 0.0, 1.0);
  if (u_hasLut > 0.5) rgb = sampleLut(rgb); // designed look, after the knobs
  rgb = mix(src.rgb, rgb, u_intensity); // dial the whole grade back toward the source

  float a = src.a;
  if (u_chroma > 0.5) {
    float d = length(rgb2uv(rgb) - rgb2uv(u_key));
    a *= smoothstep(u_sim, u_sim + max(u_blend, 0.0001), d);
  }
  // Grain last (after the key, matching ffmpeg's color->chroma->noise order) so
  // it speckles the output without biasing the key decision.
  if (u_grain > 0.0) {
    vec2 texSize = vec2(1.0 / u_texel.x, 1.0 / u_texel.y);
    float n = hash(floor(uv * texSize));
    rgb = clamp(rgb + (n - 0.5) * 2.0 * u_grain, 0.0, 1.0);
  }
  gl_FragColor = vec4(rgb * a, a);
}`;

function sourceSize(el: HTMLVideoElement | HTMLImageElement): [number, number] {
  return el instanceof HTMLVideoElement ? [el.videoWidth, el.videoHeight] : [el.naturalWidth, el.naturalHeight];
}

/**
 * Renders a clip's frames (video OR image) through the grade + chroma shader onto
 * a canvas, so temperature/tint, exposure, highlights/shadows, vignette, sharpen
 * and green-screen keying preview live and match the ffmpeg export. The source
 * element is owned by the compositor (videos are driven by the master clock);
 * this layer only reads its current frame. Falls back to drawing the raw frame
 * when WebGL is unavailable (the export still grades).
 */
export function GLClipLayer({
  getSource,
  grade,
  chroma,
  effects,
  lut,
  cube,
  className,
  style,
}: {
  getSource: () => HTMLVideoElement | HTMLImageElement | null;
  grade?: ColorAdjust | null;
  chroma?: ChromaKey | null;
  /** static effects rendered in-shader (pixelate / RGB-split / grain); blur is CSS. */
  effects?: VideoEffects | null;
  /** LUT look id to apply (bundled or `custom:`), or null for none. */
  lut?: string | null;
  /** raw `.cube` text for a custom LUT, when its bytes aren't fetchable by URL. */
  cube?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getSourceRef = useRef(getSource);
  const gradeRef = useRef(grade);
  const chromaRef = useRef(chroma);
  const effectsRef = useRef(effects);
  const lutRef = useRef(lut);
  const cubeRef = useRef(cube);
  getSourceRef.current = getSource;
  gradeRef.current = grade;
  chromaRef.current = chroma;
  effectsRef.current = effects;
  lutRef.current = lut;
  cubeRef.current = cube;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let stopped = false;

    const opts: WebGLContextAttributes = { premultipliedAlpha: true, alpha: true };
    const gl =
      (canvas.getContext('webgl', opts) as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl', opts) as unknown as WebGLRenderingContext | null);

    // No WebGL: draw the raw frame so the clip still shows (ungraded); export grades it.
    if (!gl) {
      const ctx = canvas.getContext('2d');
      const loop2d = () => {
        if (stopped) return;
        const el = getSourceRef.current();
        if (el && ctx) {
          const [w, h] = sourceSize(el);
          if (w > 0) {
            if (canvas.width !== w) {
              canvas.width = w;
              canvas.height = h;
            }
            ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
          }
        }
        raf = requestAnimationFrame(loop2d);
      };
      loop2d();
      return () => {
        stopped = true;
        cancelAnimationFrame(raf);
      };
    }

    const compile = (type: number, src: string): WebGLShader => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // The LUT is an RGB texture whose rows (size*size*3 bytes) aren't a multiple
    // of 4, so the default UNPACK_ALIGNMENT of 4 makes texImage2D reject it (the
    // upload silently fails and the black placeholder stays bound -> every Look
    // renders black). Byte-tight unpacking fixes it; video frames are RGBA and
    // unaffected.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Texture unit 1 holds the active LUT (a 1x1 placeholder until one loads).
    const lutTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));

    const u = (name: string) => gl.getUniformLocation(prog, name);
    const uBcs = u('u_bcs');
    const uHue = u('u_hue');
    const uGain = u('u_gain');
    const uTone = u('u_tone');
    const uVig = u('u_vig');
    const uSharpen = u('u_sharpen');
    const uIntensity = u('u_intensity');
    const uTexel = u('u_texel');
    const uChroma = u('u_chroma');
    const uKey = u('u_key');
    const uSim = u('u_sim');
    const uBlend = u('u_blend');
    const uLutSize = u('u_lutSize');
    const uHasLut = u('u_hasLut');
    const uPixelate = u('u_pixelate');
    const uRgbsplit = u('u_rgbsplit');
    const uGrain = u('u_grain');
    const uSeed = u('u_seed');
    gl.uniform1i(u('u_tex'), 0);
    gl.uniform1i(u('u_lut'), 1);
    gl.clearColor(0, 0, 0, 0);

    // Lazy LUT load: fetch (bundled) or use the inline cube (custom), parse, pack
    // and upload when the id changes; until ready the look just isn't applied.
    let lutLoadedId: string | null = null;
    let lutSize = 0;
    let lutLoading = false;
    const loadLut = async (id: string) => {
      lutLoading = true;
      try {
        const url = lutUrl(id);
        let text: string | null = cubeRef.current ?? null;
        if (url) {
          const res = await fetch(url);
          text = res.ok ? await res.text() : null;
        }
        if (text == null || stopped) return;
        const packed = packLut(parseCube(text));
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, lutTex);
        gl.getError(); // drain any stale error so the check below is about this upload
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, packed.width, packed.height, 0, gl.RGB, gl.UNSIGNED_BYTE, packed.pixels);
        if (gl.getError() !== gl.NO_ERROR) {
          // Upload rejected: skip the look rather than sampling the black
          // placeholder (which would blank the clip).
          lutLoadedId = null;
          lutSize = 0;
        } else {
          lutSize = packed.size;
          lutLoadedId = id;
        }
      } catch {
        lutLoadedId = null;
        lutSize = 0;
      } finally {
        lutLoading = false;
      }
    };

    const loop = () => {
      if (stopped) return;
      const el = getSourceRef.current();
      if (el) {
        const [w, h] = sourceSize(el);
        if (w > 0) {
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, canvas.width, canvas.height);
          }
          const g = gradeUniforms(gradeRef.current);
          gl.uniform3f(uBcs, g.brightness, g.contrast, g.saturation);
          gl.uniform1f(uHue, g.hue);
          gl.uniform3f(uGain, g.gain[0], g.gain[1], g.gain[2]);
          gl.uniform2f(uTone, g.toneLow, g.toneHigh);
          gl.uniform1f(uVig, g.vignette);
          gl.uniform1f(uSharpen, g.sharpen);
          gl.uniform1f(uIntensity, g.intensity);
          gl.uniform2f(uTexel, 1 / canvas.width, 1 / canvas.height);
          const fx = effectUniforms(effectsRef.current);
          gl.uniform1f(uPixelate, fx.pixelate);
          gl.uniform1f(uRgbsplit, fx.rgbSplit);
          gl.uniform1f(uGrain, fx.grain);
          // Reseed the grain each frame so it shimmers; 0 when grain is off.
          gl.uniform1f(uSeed, fx.grain > 0 ? Math.random() * 100 : 0);
          const ck = chromaRef.current;
          if (ck) {
            const [r, gg, b] = hexToRgb01(ck.color);
            gl.uniform1f(uChroma, 1);
            gl.uniform3f(uKey, r, gg, b);
            gl.uniform1f(uSim, ck.similarity);
            gl.uniform1f(uBlend, ck.blend);
          } else {
            gl.uniform1f(uChroma, 0);
          }
          const wantLut = lutRef.current;
          if (wantLut) {
            if (lutLoadedId !== wantLut && !lutLoading) loadLut(wantLut);
            gl.uniform1f(uHasLut, lutLoadedId === wantLut && lutSize > 0 ? 1 : 0);
            gl.uniform1f(uLutSize, lutSize > 0 ? lutSize : 2);
          } else {
            gl.uniform1f(uHasLut, 0);
            lutLoadedId = null;
          }
          try {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          } catch {
            // The frame can be briefly unreadable (seek/decode); skip this tick.
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      gl.deleteTexture(tex);
      gl.deleteTexture(lutTex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden />;
}
