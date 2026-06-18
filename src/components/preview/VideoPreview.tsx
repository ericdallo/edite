import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { aspectById } from '@/types/editor';
import { useVideoEngine } from '@/hooks/useVideoEngine';
import { CropOverlay } from './CropOverlay';

export function VideoPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const sourceUrl = useEditorStore((s) => s.sourceUrl);
  const source = useEditorStore((s) => s.source);
  const aspect = useEditorStore((s) => s.aspect);
  const aspectMode = useEditorStore((s) => s.aspectMode);
  const speed = useEditorStore((s) => s.speed);
  const muted = useEditorStore((s) => s.muted);
  const volume = useEditorStore((s) => s.playback.volume);
  const playing = useEditorStore((s) => s.playback.playing);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const selectedTool = useEditorStore((s) => s.selectedTool);

  useVideoEngine(videoRef);

  const displayRatio = useMemo(() => {
    const ratio = aspectById(aspect).ratio;
    if (ratio) return ratio;
    if (source?.width && source?.height) return source.width / source.height;
    return 16 / 9;
  }, [aspect, source]);

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
      let h = cw / displayRatio;
      if (h > ch) {
        h = ch;
        w = ch * displayRatio;
      }
      setBox({ w, h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [displayRatio]);

  const objectFit: CSSProperties['objectFit'] =
    aspect === 'original' ? 'contain' : aspectMode === 'fill' ? 'cover' : 'contain';

  const showPlayButton = !playing && selectedTool !== 'crop';

  return (
    <div
      ref={stageRef}
      className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_-10%,rgba(139,92,246,0.10),transparent_55%)] p-7"
    >
      <div
        className="relative overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-line"
        style={{ width: box.w || '60%', height: box.h || '60%' }}
      >
        {sourceUrl && (
          <video
            ref={videoRef}
            src={sourceUrl}
            className="h-full w-full bg-black"
            style={{ objectFit }}
            playsInline
            onClick={() => selectedTool !== 'crop' && setPlaying(!playing)}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              v.playbackRate = speed;
              v.muted = muted;
              v.volume = volume;
            }}
          />
        )}

        {selectedTool === 'crop' && box.w > 0 && <CropOverlay width={box.w} height={box.h} />}

        {showPlayButton && (
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 grid place-items-center transition-colors hover:bg-black/10"
            aria-label="Play"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-sm">
              <Play size={28} className="ml-1" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
