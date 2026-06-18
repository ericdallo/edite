import type { SourceMeta } from '@/types/editor';

function detectAudio(video: HTMLVideoElement): boolean {
  const v = video as unknown as {
    mozHasAudio?: boolean;
    webkitAudioDecodedByteCount?: number;
    audioTracks?: { length: number };
  };
  if (typeof v.mozHasAudio === 'boolean') return v.mozHasAudio;
  if (v.audioTracks && typeof v.audioTracks.length === 'number') return v.audioTracks.length > 0;
  // Unknown on this browser — assume audio exists so the mute control stays useful.
  return true;
}

/** Read duration / dimensions / audio presence from a video file. */
export function probeVideo(file: File): Promise<SourceMeta> {
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
      const meta: SourceMeta = {
        fileName: file.name,
        mimeType: file.type || 'video/mp4',
        size: file.size,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth,
        height: video.videoHeight,
        hasAudio: detectAudio(video),
      };
      cleanup();
      if (!meta.width || !meta.height) {
        reject(new Error('This file does not appear to contain a video track.'));
        return;
      }
      resolve(meta);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Could not read this video file. Try MP4, WebM or MOV.'));
    };

    video.src = url;
  });
}
