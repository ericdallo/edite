import { type CSSProperties, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { type Clip, resolveAspectRatio } from '@/types/editor';
import {
  audioFadeGain,
  clipSourceAt,
  clipSpeedAt,
  clipTransformAt,
  isClipActiveAt,
  projectDuration,
  transitionFades,
  transitionRenderAt,
} from '@/lib/timeline';
import { cssColorFilter, needsGradeShader } from '@/lib/color';
import { clamp, cn } from '@/lib/utils';
import { resolveSubtool } from '@/components/tools/subtools';
import { TransformOverlay } from './TransformOverlay';
import { TextLayer } from './TextLayer';
import { GLClipLayer } from './GLClipLayer';

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
  // Hidden <img> sources for GL-graded image clips, read by their grade layer.
  const imgEls = useRef<Map<string, HTMLImageElement>>(new Map());

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
  const selectedSubtool = useEditorStore((s) => s.selectedSubtool);
  const activeClipId = useEditorStore((s) => s.activeClipId);

  const ratio = resolveAspectRatio(aspect, media);
  const activeClip = clips.find((c) => c.id === activeClipId);
  // The on-canvas transform box belongs to Layout ▸ Transform/Animate (clip
  // placement & keyframes) and Text ▸ Text (positioning an overlay).
  const sub = resolveSubtool(selectedTool, selectedSubtool);
  const layoutBox = selectedTool === 'layout' && (sub === 'transform' || sub === 'animate');
  const textBox = selectedTool === 'text' && sub === 'text';
  const showOverlay = layoutBox || (textBox && activeClip?.text != null);
  const interactive = layoutBox || textBox;

  const [box, setBox] = useState({ w: 0, h: 0 });
  const [isFs, setIsFs] = useState(false);

  // Track fullscreen of the preview stage so the toggle icon stays in sync.
  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

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

  // Effective audio fades (folding transitions) so cross-faded clips ramp in the
  // preview the same way the export's afade does.
  const fadeMap = useMemo(() => {
    const m = new Map<string, { fadeIn: number; fadeOut: number }>();
    for (const c of clips) m.set(c.id, transitionFades(clips, c));
    return m;
  }, [clips]);

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
        // Loop: wrap back to the start and keep rolling; otherwise stop at the end.
        if (s.loop && total > 0.05) {
          setCurrentTime(0);
          last = now;
          raf = requestAnimationFrame(tick);
          return;
        }
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
      const ef = fadeMap.get(clip.id);
      const fadeGain = audioFadeGain(
        ef ? { ...clip, fadeIn: ef.fadeIn, fadeOut: ef.fadeOut } : clip,
        currentTime,
      );
      el.volume = clamp(volume * (clip.volume ?? 1) * fadeGain, 0, 1);
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
  }, [layers, media, currentTime, playing, muted, volume, fadeMap]);

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
          // A transition into this clip ramps its opacity (dissolve) and, for fade
          // types, dips through a color rendered just beneath it.
          const tr = transitionRenderAt(clip, currentTime);
          // Animated placement from the clip's keyframes (the static rect when none).
          const rect = clipTransformAt(clip, currentTime).rect;
          // Slides translate the incoming clip in; wipes/iris reveal it behind a
          // clip-path. These mirror what the export encodes.
          const slide =
            tr.offsetX || tr.offsetY
              ? `translate(${(tr.offsetX * box.w).toFixed(2)}px, ${(tr.offsetY * box.h).toFixed(2)}px)`
              : undefined;
          // Keep clips mounted and painted (opacity 0 when inactive) instead of
          // display:none so their parked frame stays decoded and shows instantly
          // at a cut — no black flash while the browser seeks/decodes.
          const style: CSSProperties = {
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
            opacity: active ? clip.opacity * tr.clipMul : 0,
            zIndex: active ? 1 : 0,
            transform: slide,
            clipPath: tr.clipPath ?? undefined,
          };

          if (clip.text) {
            return (
              <div key={clip.id} className="pointer-events-none absolute overflow-hidden" style={style}>
                <TextLayer text={clip.text} boxW={rect.w * box.w} boxH={rect.h * box.h} canvasH={box.h} />
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
          const orient = orientMediaStyle(clip, rect.w * box.w, rect.h * box.h);
          // A clip with chroma or any deeper-grade field renders through the WebGL
          // grade shader (which owns its color); legacy-only grades keep the cheap
          // CSS-filter path with no WebGL overhead.
          const gl = (m.kind === 'video' && clip.chromaKey != null) || needsGradeShader(clip.color);
          const filter = gl ? undefined : cssColorFilter(clip.color);
          // Compose orientation transform with the color filter on one element.
          const mediaStyle: CSSProperties | undefined =
            orient || filter ? { ...(orient ?? {}), filter } : undefined;
          const mediaCls = cn('object-cover', orient ? '' : 'h-full w-full');
          const registerVideo = (el: HTMLVideoElement | null) => {
            if (el) mediaEls.current.set(clip.id, el);
            else mediaEls.current.delete(clip.id);
          };
          const registerImg = (el: HTMLImageElement | null) => {
            if (el) imgEls.current.set(clip.id, el);
            else imgEls.current.delete(clip.id);
          };
          const wrapper = (
            <div className="pointer-events-none absolute overflow-hidden" style={style}>
              {gl ? (
                <>
                  {/* Hidden source: still decoded (and, for video, seeked/played by
                      the master clock); the canvas reads its frames and grades them. */}
                  {m.kind === 'video' ? (
                    <video
                      ref={registerVideo}
                      src={m.url}
                      className="pointer-events-none absolute h-px w-px opacity-0"
                      playsInline
                      muted
                      preload="auto"
                    />
                  ) : (
                    <img
                      ref={registerImg}
                      src={m.url}
                      alt=""
                      className="pointer-events-none absolute h-px w-px opacity-0"
                    />
                  )}
                  <GLClipLayer
                    getSource={() =>
                      m.kind === 'video'
                        ? ((mediaEls.current.get(clip.id) as HTMLVideoElement | undefined) ?? null)
                        : (imgEls.current.get(clip.id) ?? null)
                    }
                    grade={clip.color}
                    chroma={m.kind === 'video' ? clip.chromaKey : null}
                    lut={clip.color?.lut}
                    className={mediaCls}
                    style={mediaStyle}
                  />
                </>
              ) : m.kind === 'video' ? (
                <video
                  ref={registerVideo}
                  src={m.url}
                  className={mediaCls}
                  style={mediaStyle}
                  playsInline
                  muted
                  preload="auto"
                />
              ) : (
                <img src={m.url} alt="" className={mediaCls} style={mediaStyle} />
              )}
            </div>
          );
          // Fade transition: a solid color dip just beneath this clip (and above
          // the previous one), peaking at the overlap midpoint.
          if (active && tr.dipColor) {
            return (
              <Fragment key={clip.id}>
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: style.left,
                    top: style.top,
                    width: style.width,
                    height: style.height,
                    backgroundColor: tr.dipColor,
                    opacity: tr.dipOpacity,
                    zIndex: style.zIndex,
                  }}
                />
                {wrapper}
              </Fragment>
            );
          }
          return <Fragment key={clip.id}>{wrapper}</Fragment>;
        })}

        {showOverlay && box.w > 0 && <TransformOverlay width={box.w} height={box.h} />}
      </div>

      <button
        onClick={toggleFullscreen}
        title={isFs ? 'Exit fullscreen' : 'Fullscreen preview'}
        aria-label={isFs ? 'Exit fullscreen' : 'Fullscreen preview'}
        className="absolute right-3 top-3 z-30 grid h-8 w-8 place-items-center rounded-lg bg-black/35 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
      >
        {isFs ? <Minimize size={16} /> : <Maximize size={16} />}
      </button>
    </div>
  );
}
