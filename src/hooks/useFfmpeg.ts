import { useCallback, useState } from 'react';
import { getFFmpeg, isFFmpegLoaded } from '@/lib/ffmpeg/client';

export interface UseFfmpeg {
  loading: boolean;
  loaded: boolean;
  error: string | null;
  ensureLoaded: () => Promise<void>;
}

/** Lazily loads the ffmpeg.wasm core (≈32 MB) on first use, e.g. when exporting. */
export function useFfmpeg(): UseFfmpeg {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(isFFmpegLoaded());
  const [error, setError] = useState<string | null>(null);

  const ensureLoaded = useCallback(async () => {
    if (isFFmpegLoaded()) {
      setLoaded(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await getFFmpeg();
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the video engine.');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, loaded, error, ensureLoaded };
}
