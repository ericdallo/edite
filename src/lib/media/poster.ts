import type { Clip, MediaItem, Track } from '@/types/editor';
import { isTextClip } from '@/types/editor';

export interface PosterSource {
  mediaId: string;
  /** source-time (seconds) of the representative frame. */
  time: number;
}

/**
 * Pick the frame that best represents a project for its list poster: the
 * earliest visual clip (not hidden, not on a hidden track, not text or
 * audio-only) backed by a video or image. Pure so it can be unit-tested and
 * used to gate poster regeneration.
 */
export function posterSourceFor(
  clips: Clip[],
  tracks: Track[],
  media: Pick<MediaItem, 'id' | 'kind'>[],
): PosterSource | null {
  const hiddenTracks = new Set(tracks.filter((t) => t.hidden).map((t) => t.id));
  const kindById = new Map(media.map((m) => [m.id, m.kind] as const));

  let best: Clip | null = null;
  for (const clip of clips) {
    if (clip.hidden || isTextClip(clip) || clip.audioOnly) continue;
    if (hiddenTracks.has(clip.trackId)) continue;
    const kind = kindById.get(clip.mediaId);
    if (kind !== 'video' && kind !== 'image') continue;
    if (!best || clip.start < best.start) best = clip;
  }
  if (!best) return null;
  return { mediaId: best.mediaId, time: best.freeze ?? best.in };
}

function drawToJpeg(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  width: number,
): string | null {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round((w * (sh || 9)) / (sw || 16)));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.6);
}

function posterFromImage(url: string, width: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(drawToJpeg(img, img.naturalWidth, img.naturalHeight, width));
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = url;
  });
}

function posterFromVideo(url: string, time: number, width: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('video decode failed'));
    };
    video.onloadeddata = () => {
      const limit = video.duration && isFinite(video.duration) ? video.duration - 0.001 : time;
      video.addEventListener(
        'seeked',
        () => {
          const out = drawToJpeg(video, video.videoWidth, video.videoHeight, width);
          cleanup();
          resolve(out);
        },
        { once: true },
      );
      video.currentTime = Math.max(0, Math.min(time, limit));
    };
  });
}

/** Decode a small JPEG data-URL poster from a media item. Best-effort: null on failure. */
export async function generatePoster(
  media: MediaItem,
  time: number,
  width = 320,
): Promise<string | null> {
  try {
    if (media.kind === 'image') return await posterFromImage(media.url, width);
    if (media.kind === 'video') return await posterFromVideo(media.url, time, width);
    return null;
  } catch {
    return null;
  }
}
