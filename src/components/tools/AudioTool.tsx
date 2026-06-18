import { AudioLines, Volume2, VolumeX } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { AUDIO_FADE_MAX, CLIP_VOLUME_MAX } from '@/lib/constants';
import { clipTimelineDuration } from '@/lib/timeline';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/Slider';

/** Small pill switch used for both the clip and project mute toggles. */
function Toggle({ on }: { on: boolean }) {
  return (
    <span className={cn('relative h-6 w-11 rounded-full transition-colors', on ? 'bg-surface-3' : 'bg-brand')}>
      <span
        className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', on ? 'left-0.5' : 'left-[22px]')}
      />
    </span>
  );
}

export function AudioTool() {
  const clips = useEditorStore((s) => s.clips);
  const media = useEditorStore((s) => s.media);
  const activeId = useEditorStore((s) => s.activeClipId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const updateClips = useEditorStore((s) => s.updateClips);
  const extractAudio = useEditorStore((s) => s.extractAudio);
  const muted = useEditorStore((s) => s.muted);
  const toggleMute = useEditorStore((s) => s.toggleMute);
  const volume = useEditorStore((s) => s.playback.volume);
  const setVolume = useEditorStore((s) => s.setVolume);

  const clip = clips.find((c) => c.id === activeId);
  const clipMedia = clip ? media.find((m) => m.id === clip.mediaId) : undefined;
  const carriesAudio =
    !!clip &&
    !clip.text &&
    (clipMedia?.kind === 'audio' || (clipMedia?.kind === 'video' && clipMedia.hasAudio));
  const canExtract =
    !!clip && clipMedia?.kind === 'video' && !clip.audioOnly && clip.freeze == null && !!clipMedia?.hasAudio;

  const count = selectedIds.length;
  const dur = clip ? clipTimelineDuration(clip) : 0;
  const fadeMax = Math.max(0.1, Math.min(AUDIO_FADE_MAX, dur || AUDIO_FADE_MAX));
  const clipMuted = clip?.muted ?? false;

  return (
    <div className="space-y-6">
      {clip && carriesAudio ? (
        <div className="space-y-5">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Selected clip</div>

          <button
            onClick={() => updateClips(selectedIds, { muted: !clipMuted })}
            className={cn(
              'flex w-full items-center justify-between rounded-xl border px-4 py-3 transition-colors',
              clipMuted ? 'border-danger/50 bg-danger/10' : 'border-line bg-surface-2',
            )}
          >
            <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
              {clipMuted ? (
                <VolumeX size={18} className="text-danger" />
              ) : (
                <Volume2 size={18} className="text-ink-muted" />
              )}
              {clipMuted ? 'Clip muted' : 'Clip audio on'}
            </span>
            <Toggle on={clipMuted} />
          </button>

          <div className={cn(clipMuted && 'pointer-events-none opacity-40')}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-ink-muted">Volume</span>
              <span className="font-mono text-ink">{Math.round((clip.volume ?? 1) * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={CLIP_VOLUME_MAX}
              step={0.01}
              value={clip.volume ?? 1}
              onChange={(v) => updateClips(selectedIds, { volume: v })}
              ariaLabel="Clip volume"
            />
          </div>

          <div className={cn('grid grid-cols-2 gap-3', clipMuted && 'pointer-events-none opacity-40')}>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-ink-muted">Fade in</span>
                <span className="font-mono text-ink">{(clip.fadeIn ?? 0).toFixed(1)}s</span>
              </div>
              <Slider
                min={0}
                max={fadeMax}
                step={0.05}
                value={Math.min(clip.fadeIn ?? 0, fadeMax)}
                onChange={(v) => updateClips(selectedIds, { fadeIn: v })}
                ariaLabel="Fade in"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-ink-muted">Fade out</span>
                <span className="font-mono text-ink">{(clip.fadeOut ?? 0).toFixed(1)}s</span>
              </div>
              <Slider
                min={0}
                max={fadeMax}
                step={0.05}
                value={Math.min(clip.fadeOut ?? 0, fadeMax)}
                onChange={(v) => updateClips(selectedIds, { fadeOut: v })}
                ariaLabel="Fade out"
              />
            </div>
          </div>

          {canExtract && (
            <button
              onClick={() => extractAudio(clip.id)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <AudioLines size={16} /> Extract audio to its own track
            </button>
          )}

          <p className="text-xs leading-relaxed text-ink-faint">
            {count > 1
              ? `Volume and fades apply to all ${count} selected clips.`
              : 'A boost above 100% is applied on export; the preview here caps at 100%.'}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-faint">
          {clip ? 'This clip has no audio.' : 'Select a clip with sound to adjust its volume and fades.'}
        </p>
      )}

      <div className="space-y-5 border-t border-line pt-5">
        <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Project audio</div>

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
            {muted ? 'All audio muted' : 'Audio on'}
          </span>
          <Toggle on={muted} />
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
            : 'Muting removes audio from the exported file. Preview volume only affects playback here.'}
        </p>
      </div>
    </div>
  );
}
