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

/**
 * Sample `count` evenly-spaced frames from a video and return them as small
 * JPEG data URLs for the timeline strip. Works on same-origin blob URLs.
 */
export async function generateThumbnails(
  src: string,
  duration: number,
  count: number,
  opts?: { width?: number; signal?: AbortSignal },
): Promise<Thumbnail[]> {
  const targetWidth = opts?.width ?? 160;
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
  if (!ctx || duration <= 0) return thumbs;

  for (let i = 0; i < count; i++) {
    if (opts?.signal?.aborted) break;
    const t = ((i + 0.5) / count) * duration;
    try {
      await seek(video, Math.min(t, Math.max(0, duration - 0.05)));
      ctx.drawImage(video, 0, 0, targetWidth, height);
      thumbs.push({ time: t, url: canvas.toDataURL('image/jpeg', 0.6) });
    } catch {
      // Skip frames that fail to decode.
    }
  }

  video.removeAttribute('src');
  video.load();
  return thumbs;
}
