/**
 * Decode a single frame of a video to a PNG blob — used to rasterize a freeze
 * frame for export (the same source frame the preview holds, so it's WYSIWYG).
 */
export function renderFrameToBlob(source: Blob, time: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    const fail = (msg: string) => {
      cleanup();
      reject(new Error(msg));
    };

    video.onerror = () => fail('Could not decode the video to freeze a frame.');
    video.onloadeddata = () => {
      const limit = video.duration && isFinite(video.duration) ? video.duration - 0.001 : time;
      const onSeeked = () => {
        try {
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (!w || !h) return fail('Frozen frame has no dimensions.');
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return fail('No 2D canvas context for the freeze frame.');
          ctx.drawImage(video, 0, 0, w, h);
          canvas.toBlob((blob) => {
            cleanup();
            if (blob) resolve(blob);
            else reject(new Error('Failed to encode the frozen frame.'));
          }, 'image/png');
        } catch (e) {
          fail(e instanceof Error ? e.message : 'Freeze frame failed.');
        }
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      video.currentTime = Math.max(0, Math.min(time, limit));
    };
  });
}
