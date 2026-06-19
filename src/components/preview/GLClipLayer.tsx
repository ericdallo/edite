import { type CSSProperties, useEffect, useRef } from 'react';
import type { ChromaKey, ColorAdjust } from '@/types/editor';
import { gradeUniforms } from '@/lib/color';
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
uniform float u_chroma; // 1 = key enabled
uniform vec3 u_key;
uniform float u_sim;
uniform float u_blend;
varying vec2 v_uv;

const vec3 LUM = vec3(0.213, 0.715, 0.072);

vec2 rgb2uv(vec3 c) {
  float u = -0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b + 0.5;
  float v = 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b + 0.5;
  return vec2(u, v);
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
  vec4 src = texture2D(u_tex, v_uv);
  vec3 rgb = src.rgb;

  // Unsharp detail from the raw neighbourhood, re-added after grading.
  vec3 detail = vec3(0.0);
  if (u_sharpen > 0.0) {
    vec3 blur = (
      texture2D(u_tex, v_uv + vec2(u_texel.x, 0.0)).rgb +
      texture2D(u_tex, v_uv - vec2(u_texel.x, 0.0)).rgb +
      texture2D(u_tex, v_uv + vec2(0.0, u_texel.y)).rgb +
      texture2D(u_tex, v_uv - vec2(0.0, u_texel.y)).rgb) * 0.25;
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
  rgb = mix(src.rgb, rgb, u_intensity); // dial the whole grade back toward the source

  float a = src.a;
  if (u_chroma > 0.5) {
    float d = length(rgb2uv(rgb) - rgb2uv(u_key));
    a *= smoothstep(u_sim, u_sim + max(u_blend, 0.0001), d);
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
  className,
  style,
}: {
  getSource: () => HTMLVideoElement | HTMLImageElement | null;
  grade?: ColorAdjust | null;
  chroma?: ChromaKey | null;
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getSourceRef = useRef(getSource);
  const gradeRef = useRef(grade);
  const chromaRef = useRef(chroma);
  getSourceRef.current = getSource;
  gradeRef.current = grade;
  chromaRef.current = chroma;

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

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

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
    gl.clearColor(0, 0, 0, 0);

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
          try {
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
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} style={style} aria-hidden />;
}
