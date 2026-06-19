import { type CSSProperties, useEffect, useRef } from 'react';
import type { ChromaKey } from '@/types/editor';
import { hexToRgb01 } from '@/lib/chroma';

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2((a_pos.x + 1.0) * 0.5, (1.0 - a_pos.y) * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Luma-independent keying: distance on the chroma (U,V) plane, like ffmpeg's
// chromakey, so green of any brightness keys out. Output is premultiplied so the
// transparent edges composite cleanly over the track below.
const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec3 u_key;
uniform float u_sim;
uniform float u_blend;
varying vec2 v_uv;
vec2 rgb2uv(vec3 c) {
  float u = -0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b + 0.5;
  float v = 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b + 0.5;
  return vec2(u, v);
}
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  float d = length(rgb2uv(c.rgb) - rgb2uv(u_key));
  float a = c.a * smoothstep(u_sim, u_sim + max(u_blend, 0.0001), d);
  gl_FragColor = vec4(c.rgb * a, a);
}`;

/**
 * Renders a video clip's frames through a chroma-key shader onto a canvas, so
 * the green-screen color is removed live in the preview (matching the export's
 * `chromakey` filter). The <video> element itself is owned by the compositor and
 * driven by the master clock; this layer only reads its current frame.
 */
export function ChromaLayer({
  getVideo,
  chroma,
  className,
  style,
}: {
  getVideo: () => HTMLVideoElement | null;
  chroma: ChromaKey;
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getVideoRef = useRef(getVideo);
  const chromaRef = useRef(chroma);
  getVideoRef.current = getVideo;
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

    // No WebGL: draw the raw frame so the clip still shows (un-keyed); export keys it.
    if (!gl) {
      const ctx = canvas.getContext('2d');
      const loop2d = () => {
        if (stopped) return;
        const v = getVideoRef.current();
        if (v && v.videoWidth > 0 && ctx) {
          if (canvas.width !== v.videoWidth) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
          }
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
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

    const uKey = gl.getUniformLocation(prog, 'u_key');
    const uSim = gl.getUniformLocation(prog, 'u_sim');
    const uBlend = gl.getUniformLocation(prog, 'u_blend');
    gl.clearColor(0, 0, 0, 0);

    const loop = () => {
      if (stopped) return;
      const v = getVideoRef.current();
      if (v && v.videoWidth > 0) {
        if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          gl.viewport(0, 0, canvas.width, canvas.height);
        }
        const ck = chromaRef.current;
        const [r, g, b] = hexToRgb01(ck.color);
        gl.uniform3f(uKey, r, g, b);
        gl.uniform1f(uSim, ck.similarity);
        gl.uniform1f(uBlend, ck.blend);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        } catch {
          // The frame can be briefly unreadable (seek/decode); skip this tick.
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
