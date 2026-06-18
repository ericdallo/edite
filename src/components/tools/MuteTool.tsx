import { Volume2, VolumeX } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/Slider';

export function MuteTool() {
  const muted = useEditorStore((s) => s.muted);
  const toggleMute = useEditorStore((s) => s.toggleMute);
  const volume = useEditorStore((s) => s.playback.volume);
  const setVolume = useEditorStore((s) => s.setVolume);

  return (
    <div className="space-y-5">
      <button
        onClick={toggleMute}
        className={cn(
          'flex w-full items-center justify-between rounded-xl border px-4 py-3 transition-colors',
          muted ? 'border-danger/50 bg-danger/10' : 'border-line bg-surface-2',
        )}
      >
        <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
          {muted ? (
            <VolumeX size={18} className="text-danger" />
          ) : (
            <Volume2 size={18} className="text-ink-muted" />
          )}
          {muted ? 'Audio muted' : 'Audio on'}
        </span>
        <span
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            muted ? 'bg-surface-3' : 'bg-brand',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
              muted ? 'left-0.5' : 'left-[22px]',
            )}
          />
        </span>
      </button>

      <div className={cn(muted && 'pointer-events-none opacity-40')}>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-ink-muted">Preview volume</span>
          <span className="font-mono text-ink">{Math.round(volume * 100)}%</span>
        </div>
        <Slider min={0} max={1} step={0.01} value={volume} onChange={setVolume} ariaLabel="Preview volume" />
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        {muted
          ? 'The exported video will have no audio track.'
          : 'Muting removes the audio from the exported file. Preview volume only affects playback here.'}
      </p>
    </div>
  );
}
