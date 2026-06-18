import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { type Clip, resolveAspectRatio } from '@/types/editor';
import { audioFadeGain, clipSourceAt, clipSpeedAt, isClipActiveAt, projectDuration } from '@/lib/timeline';
import { clamp, cn } from '@/lib/utils';
import { TransformOverlay } from './TransformOverlay';
import { TextLayer } from './TextLayer';

/**
 * CSS to mirror/flip/rotate a clip's media so it matches the export. For 90/270
 * the element is sized with swapped pixel dimensions and rotated, so the clip
 * still cover-fills its box. Returns undefined when there's nothing to apply.
 */
function orientMediaStyle(clip: Clip, wrapperW: number, wrapperH: number): CSSProperties | undefined {
  const rot = (((Math.round((clip.rotation || 0) / 90) * 90) % 360) + 360) % 360;
  const sx = clip.flipH ? -1 : 1;
  const sy = clip.flipV ? -1 : 1;
  if ((rot === 0 && sx === 1 && sy === 1) || wrapperW <= 0 || wrapperH <= 0) return undefined;
  const swap = rot === 90 || rot === 270;
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: swap ? wrapperH : wrapperW,
    height: swap ? wrapperW : wrapperH,
    transform: `translate(-50%, -50%) rotate(${rot}deg) scaleX(${sx}) scaleY(${sy})`,
  };
}

export function VideoPreview() {
  const stageRef = useRef<HTMLDivElement>(null);
  // Holds every playable element (videos and standalone/detached audio) by clip id.
  const mediaEls = useRef<Map<string, HTMLMediaElement>>(new Map());

  const media = useEditorStore((s) => s.media);
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const aspect = useEditorStore((s) => s.aspect);
  const background = useEditorStore((s) => s.background);
  const muted = useEditorStore((s) => s.muted);
  const volume = useEditorStore((s) => s.playback.volume);
  const playing = useEditorStore((s) => s.playback.playing);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const activeClipId = useEditorStore((s) => s.activeClipId);

  const ratio = resolveAspectRatio(aspect, media);
  const activeClip = clips.find((c) => c.id === activeClipId);
  const showOverlay =
    selectedTool === 'transform' || (selectedTool === 'text' && activeClip?.text != null);
  const interactive = selectedTool === 'transform' || selectedTool === 'text';

  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const pad = el.clientWidth < 640 ? 12 : 28;
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

  // Keep each <video>/<audio> in sync with the master clock.
  useEffect(() => {
    for (const { clip, track } of layers) {
      const m = media.find((x) => x.id === clip.mediaId);
      // Videos and audio (standalone or detached) drive a media element; images don't.
      if (!m || (m.kind !== 'video' && m.kind !== 'audio')) continue;
      const el = mediaEls.current.get(clip.id);
      if (!el) continue;
      const active = isClipActiveAt(clip, currentTime) && !track.hidden;
      el.muted = muted || clip.muted || track.muted;
      // Per-clip gain × fade ramp, capped at 1.0 (HTMLMediaElement can't boost above 100%).
      el.volume = clamp(volume * (clip.volume ?? 1) * audioFadeGain(clip, currentTime), 0, 1);
      if (clip.freeze != null) {
        // Held still: pin the element to the frozen frame and never advance it.
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - clip.freeze) > 0.05) el.currentTime = clip.freeze;
        continue;
      }
      el.playbackRate = clamp(clipSpeedAt(clip, currentTime), 0.0625, 16);
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
      className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_-10%,rgba(139,92,246,0.10),transparent_55%)] p-3 sm:p-5 lg:p-7"
    >
      <div
        className="relative overflow-hidden rounded-xl shadow-2xl ring-1 ring-line"
        style={{ width: box.w || '60%', height: box.h || '60%', backgroundColor: background }}
        onClick={() => !interactive && setPlaying(!playing)}
      >
        {layers.map(({ clip, track }) => {
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

          if (clip.text) {
            return (
              <div key={clip.id} className="pointer-events-none absolute overflow-hidden" style={style}>
                <TextLayer text={clip.text} boxW={clip.rect.w * box.w} boxH={clip.rect.h * box.h} canvasH={box.h} />
              </div>
            );
          }

          const m = media.find((x) => x.id === clip.mediaId);
          if (!m) return null;
          // Standalone or detached audio has no visual — render a hidden element
          // that the sync loop drives for sound only.
          if (m.kind === 'audio' || clip.audioOnly) {
            return (
              <audio
                key={clip.id}
                ref={(el) => {
                  if (el) mediaEls.current.set(clip.id, el);
                  else mediaEls.current.delete(clip.id);
                }}
                src={m.url}
                preload="auto"
                className="hidden"
              />
            );
          }
          const orient = orientMediaStyle(clip, clip.rect.w * box.w, clip.rect.h * box.h);
          const mediaCls = cn('object-cover', orient ? '' : 'h-full w-full');
          return (
            <div key={clip.id} className="pointer-events-none absolute overflow-hidden" style={style}>
              {m.kind === 'video' ? (
                <video
                  ref={(el) => {
                    if (el) mediaEls.current.set(clip.id, el);
                    else mediaEls.current.delete(clip.id);
                  }}
                  src={m.url}
                  className={mediaCls}
                  style={orient}
                  playsInline
                  muted
                  preload="auto"
                />
              ) : (
                <img src={m.url} alt="" className={mediaCls} style={orient} />
              )}
            </div>
          );
        })}

        {showOverlay && box.w > 0 && <TransformOverlay width={box.w} height={box.h} />}
      </div>
    </div>
  );
}
