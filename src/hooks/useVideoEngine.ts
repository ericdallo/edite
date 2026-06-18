import { type RefObject, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { resolvePlayback, sortSegments } from '@/lib/segments';

/**
 * Drives a <video> element from the editor store: applies speed / mute / volume,
 * play & pause, scrub seeking, and enforces the kept-segment boundaries so the
 * preview plays exactly what will be exported (skipping removed parts).
 */
export function useVideoEngine(videoRef: RefObject<HTMLVideoElement | null>) {
  const speed = useEditorStore((s) => s.speed);
  const muted = useEditorStore((s) => s.muted);
  const volume = useEditorStore((s) => s.playback.volume);
  const playing = useEditorStore((s) => s.playback.playing);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const segments = useEditorStore((s) => s.segments);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = speed;
  }, [speed, videoRef]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = muted;
      v.volume = volume;
    }
  }, [muted, volume, videoRef]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      const r = resolvePlayback(segments, v.currentTime);
      if (r.action === 'end') {
        const first = sortSegments(segments)[0];
        if (first) v.currentTime = first.start;
      }
      v.play().catch(() => setPlaying(false));
    } else {
      v.pause();
    }
    // segments intentionally omitted: only react to play/pause toggles here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, videoRef, setPlaying]);

  // Seek when an external scrub moves the playhead while paused.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!playing && Math.abs(v.currentTime - currentTime) > 0.2) {
      v.currentTime = currentTime;
    }
  }, [currentTime, playing, videoRef]);

  // Playback loop: advance the store clock and skip across removed gaps.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused) {
        const t = v.currentTime;
        const r = resolvePlayback(segments, t);
        if (r.action === 'seek') v.currentTime = r.to;
        else if (r.action === 'end') {
          v.pause();
          setPlaying(false);
        } else {
          setCurrentTime(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, segments, setCurrentTime, setPlaying, videoRef]);
}
