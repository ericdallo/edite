import { useCallback, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { BACKGROUND_BLUR, canvasSize, resolveAspectRatio } from '@/types/editor';
import { projectDuration } from '@/lib/timeline';
import { buildExportPlan } from '@/lib/ffmpeg/plan';
import { runExport, type MultiExportParams } from '@/lib/ffmpeg/operations';
import { useFfmpeg } from '@/hooks/useFfmpeg';
import { logger } from '@/lib/log';

export interface UseSnapshot {
  /** Render the composited frame at the playhead and download it as a PNG. */
  snapshot: () => Promise<void>;
  busy: boolean;
  error: string | null;
}

/**
 * Grab a still of the current frame: it runs the same export pipeline for a
 * single PNG at the playhead time, so the snapshot matches what an export would
 * burn (grade, effects, masks, crop, text, transitions — all of it).
 */
export function useSnapshot(): UseSnapshot {
  const { ensureLoaded } = useFfmpeg();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snapshot = useCallback(async () => {
    const s = useEditorStore.getState();
    const { tracks, clips, media, aspect, background, exportSettings, customLuts, projectName } = s;
    const duration = projectDuration(clips);
    if (clips.length === 0 || duration <= 0) return;
    const t = Math.min(s.playback.currentTime, Math.max(0, duration - 1e-3));

    setBusy(true);
    setError(null);
    try {
      await ensureLoaded();
      const { width: canvasW, height: canvasH } = canvasSize(
        resolveAspectRatio(aspect, media),
        exportSettings.resolution,
      );
      const plan = buildExportPlan(tracks, clips, media, background === BACKGROUND_BLUR);
      const params: MultiExportParams = {
        canvasW,
        canvasH,
        fps: exportSettings.fps,
        duration,
        clips: plan.clips,
        format: 'png',
        quality: exportSettings.quality,
        audioBitrate: exportSettings.audioBitrate,
        videoBitrate: exportSettings.videoBitrate,
        globalMuted: true,
        background,
        snapshotTime: t,
      };
      const out = await runExport({
        params,
        media: plan.media,
        clipMediaIds: plan.clipMediaIds,
        luts: customLuts.map((l) => ({ id: l.id, cube: l.cube })),
      });
      const url = URL.createObjectURL(out);
      const base = (projectName || 'edite').replace(/[^\w.-]+/g, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}_${Math.round(t * 1000)}ms.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      logger.error('snapshot failed:', e);
      setError(e instanceof Error ? e.message : 'Snapshot failed.');
    } finally {
      setBusy(false);
    }
  }, [ensureLoaded]);

  return { snapshot, busy, error };
}
