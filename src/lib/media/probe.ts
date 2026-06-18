import type { MediaKind } from '@/types/editor';

export interface ProbedMedia {
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

function detectAudio(video: HTMLVideoElement): boolean {
  const v = video as unknown as { mozHasAudio?: boolean; audioTracks?: { length: number } };
  if (typeof v.mozHasAudio === 'boolean') return v.mozHasAudio;
  if (v.audioTracks && typeof v.audioTracks.length === 'number') return v.audioTracks.length > 0;
  return true;
}

function probeImage(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      if (!dims.width || !dims.height) reject(new Error('Could not read this image.'));
      else resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image.'));
    };
    img.src = url;
  });
}

function probeVideo(file: File): Promise<{ duration: number; width: number; height: number; hasAudio: boolean }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    video.onloadedmetadata = () => {
      const out = {
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth,
        height: video.videoHeight,
        hasAudio: detectAudio(video),
      };
      cleanup();
      if (!out.width || !out.height) reject(new Error('This file has no video track.'));
      else resolve(out);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Could not read this video file. Try MP4, WebM or MOV.'));
    };
    video.src = url;
  });
}

/** Read metadata for a video or image file. */
export async function probeMedia(file: File): Promise<ProbedMedia> {
  const base = { fileName: file.name, mimeType: file.type, size: file.size };
  if (file.type.startsWith('image/')) {
    const { width, height } = await probeImage(file);
    return { kind: 'image', duration: 0, width, height, hasAudio: false, ...base };
  }
  const { duration, width, height, hasAudio } = await probeVideo(file);
  return { kind: 'video', duration, width, height, hasAudio, ...base };
}
