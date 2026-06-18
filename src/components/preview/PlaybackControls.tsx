import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { outputDuration, sortSegments, sourceToOutput } from '@/lib/segments';
import { formatTime } from '@/lib/utils';

export function PlaybackControls() {
  const segments = useEditorStore((s) => s.segments);
  const playing = useEditorStore((s) => s.playback.playing);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const muted = useEditorStore((s) => s.muted);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const toggleMute = useEditorStore((s) => s.toggleMute);

  const sorted = sortSegments(segments);
  const outDur = outputDuration(segments);
  const outPos = sourceToOutput(segments, currentTime) ?? 0;

  const toStart = () => {
    setPlaying(false);
    setCurrentTime(sorted[0]?.start ?? 0);
  };
  const toEnd = () => {
    setPlaying(false);
    setCurrentTime(sorted[sorted.length - 1]?.end ?? 0);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <button
          onClick={toStart}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Jump to start"
        >
          <SkipBack size={17} />
        </button>
        <button
          onClick={() => setPlaying(!playing)}
          className="grid h-9 w-9 place-items-center rounded-full bg-ink text-canvas transition-transform hover:scale-105 active:scale-95"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <button
          onClick={toEnd}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Jump to end"
        >
          <SkipForward size={17} />
        </button>
      </div>

      <div className="min-w-[128px] text-center font-mono text-xs tabular-nums text-ink-muted">
        <span className="text-ink">{formatTime(outPos)}</span>
        <span className="px-1 text-ink-faint">/</span>
        <span>{formatTime(outDur)}</span>
      </div>

      <button
        onClick={toggleMute}
        className={`grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-surface-2 ${
          muted ? 'text-danger' : 'text-ink-muted hover:text-ink'
        }`}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>
    </div>
  );
}
