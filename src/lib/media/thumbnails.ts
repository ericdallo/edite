export interface Thumbnail {
  time: number;
  url: string;
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

export interface ThumbOptions {
  from?: number;
  to: number;
  count: number;
  width?: number;
  signal?: AbortSignal;
}

/** Sample evenly-spaced JPEG frames from a video range (same-origin blob URLs). */
export async function generateThumbnails(src: string, opts: ThumbOptions): Promise<Thumbnail[]> {
  const from = opts.from ?? 0;
  const span = Math.max(0.0001, opts.to - from);
  const count = Math.max(1, opts.count);
  const targetWidth = opts.width ?? 160;

  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.preload = 'auto';
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('Could not load video for thumbnails.'));
  });

  const vw = video.videoWidth || 16;
  const vh = video.videoHeight || 9;
  const height = Math.max(1, Math.round((targetWidth * vh) / vw));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const thumbs: Thumbnail[] = [];
  if (!ctx) return thumbs;

  for (let i = 0; i < count; i++) {
    if (opts.signal?.aborted) break;
    const t = from + ((i + 0.5) / count) * span;
    try {
      await seek(video, Math.max(0, t));
      ctx.drawImage(video, 0, 0, targetWidth, height);
      thumbs.push({ time: t, url: canvas.toDataURL('image/jpeg', 0.55) });
    } catch {
      // skip frames that fail to decode
    }
  }

  video.removeAttribute('src');
  video.load();
  return thumbs;
}
