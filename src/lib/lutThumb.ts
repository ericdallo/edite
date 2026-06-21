import { LUT_ORIGINAL_THUMB, parseCube, sampleLut } from '@/lib/lut';

// Renders a preview thumbnail for an imported custom LUT by applying it to the
// same portrait sample the bundled looks use (public/luts/thumbs/_original.png),
// so a custom `.cube` shows a real graded thumbnail instead of a flat swatch.
// Results are cached by cube text. Browser-only (uses canvas).

let basePromise: Promise<ImageData> | null = null;

function loadBaseSample(): Promise<ImageData> {
  if (basePromise) return basePromise;
  basePromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d');
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, cv.width, cv.height));
    };
    img.onerror = () => reject(new Error('failed to load sample image'));
    img.src = LUT_ORIGINAL_THUMB;
  });
  return basePromise;
}

const cache = new Map<string, string>();

/** Apply a `.cube` to the sample image and return a PNG data URL (cached). */
export async function renderCustomLutThumb(cube: string): Promise<string> {
  const hit = cache.get(cube);
  if (hit) return hit;

  const base = await loadBaseSample();
  const parsed = parseCube(cube);
  const out = new ImageData(base.width, base.height);
  const src = base.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const [r, g, b] = sampleLut(parsed, src[i] / 255, src[i + 1] / 255, src[i + 2] / 255);
    dst[i] = Math.round(r * 255);
    dst[i + 1] = Math.round(g * 255);
    dst[i + 2] = Math.round(b * 255);
    dst[i + 3] = src[i + 3];
  }

  const cv = document.createElement('canvas');
  cv.width = base.width;
  cv.height = base.height;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.putImageData(out, 0, 0);
  const url = cv.toDataURL('image/png');
  cache.set(cube, url);
  return url;
}
