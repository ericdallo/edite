import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { resolveAspectRatio } from '@/types/editor';
import { clipSourceAt, isClipActiveAt, projectDuration } from '@/lib/timeline';
import { TransformOverlay } from './TransformOverlay';

export function VideoPreview() {
  const stageRef = useRef<HTMLDivElement>(null);
  const videoEls = useRef<Map<string, HTMLVideoElement>>(new Map());

  const media = useEditorStore((s) => s.media);
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const aspect = useEditorStore((s) => s.aspect);
  const muted = useEditorStore((s) => s.muted);
  const volume = useEditorStore((s) => s.playback.volume);
  const playing = useEditorStore((s) => s.playback.playing);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const selectedTool = useEditorStore((s) => s.selectedTool);

  const ratio = resolveAspectRatio(aspect, media);

  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const pad = 28;
      const cw = el.clientWidth - pad * 2;
      const ch = el.clientHeight - pad * 2;
      if (cw <= 0 || ch <= 0) return;
      let w = cw;
      let h = cw / ratio;
      if (h > ch) {
        h = ch;
        w = ch * ratio;
      }
      setBox({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);

  // Composite order: bottom track first (later DOM = higher layer).
  const layers = useMemo(
    () =>
      tracks.flatMap((track) =>
        clips.filter((c) => c.trackId === track.id).map((clip) => ({ clip, track })),
      ),
    [tracks, clips],
  );

  // Master clock: advance the timeline in real time while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const s = useEditorStore.getState();
      const total = projectDuration(s.clips);
      const next = s.playback.currentTime + dt;
      if (next >= total) {
        setCurrentTime(total);
        setPlaying(false);
        return;
      }
      setCurrentTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, setCurrentTime, setPlaying]);

  // Keep each <video> in sync with the master clock.
  useEffect(() => {
    for (const { clip, track } of layers) {
      const m = media.find((x) => x.id === clip.mediaId);
      if (!m || m.kind !== 'video') continue;
      const el = videoEls.current.get(clip.id);
      if (!el) continue;
      const active = isClipActiveAt(clip, currentTime) && !track.hidden;
      el.muted = muted || clip.muted || track.muted;
      el.volume = volume;
      el.playbackRate = clip.speed;
      if (active) {
        const want = clipSourceAt(clip, currentTime);
        const tol = playing ? 0.34 : 0.05;
        if (Math.abs(el.currentTime - want) > tol) el.currentTime = want;
        if (playing && el.paused) el.play().catch(() => undefined);
        if (!playing && !el.paused) el.pause();
      } else {
        if (!el.paused) el.pause();
        // Park inactive clips on the frame nearest the playhead (their in-point
        // for upcoming clips) so a cut never flashes the media's first frame,
        // which is often black.
        const parked = clipSourceAt(clip, currentTime);
        if (Math.abs(el.currentTime - parked) > 0.05) el.currentTime = parked;
      }
    }
  }, [layers, media, currentTime, playing, muted, volume]);

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_-10%,rgba(139,92,246,0.10),transparent_55%)] p-7"
    >
      <div
        className="relative overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-line"
        style={{ width: box.w || '60%', height: box.h || '60%' }}
        onClick={() => selectedTool !== 'transform' && setPlaying(!playing)}
      >
        {layers.map(({ clip, track }) => {
          const m = media.find((x) => x.id === clip.mediaId);
          if (!m) return null;
          const active = isClipActiveAt(clip, currentTime) && !track.hidden;
          // Keep clips mounted and painted (opacity 0 when inactive) instead of
          // display:none so their parked frame stays decoded and shows instantly
          // at a cut — no black flash while the browser seeks/decodes.
          const style = {
            left: `${clip.rect.x * 100}%`,
            top: `${clip.rect.y * 100}%`,
            width: `${clip.rect.w * 100}%`,
            height: `${clip.rect.h * 100}%`,
            opacity: active ? clip.opacity : 0,
            zIndex: active ? 1 : 0,
          } as const;
          return (
            <div key={clip.id} className="pointer-events-none absolute overflow-hidden" style={style}>
              {m.kind === 'video' ? (
                <video
                  ref={(el) => {
                    if (el) videoEls.current.set(clip.id, el);
                    else videoEls.current.delete(clip.id);
                  }}
                  src={m.url}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                  preload="auto"
                />
              ) : (
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
          );
        })}

        {selectedTool === 'transform' && box.w > 0 && <TransformOverlay width={box.w} height={box.h} />}
      </div>
    </div>
  );
}
