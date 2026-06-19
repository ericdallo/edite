import { ChevronLeft, ChevronRight, Diamond, Trash2 } from 'lucide-react';
import { DEFAULT_TEXT_ANIM, TEXT_ANIMS, type TextAnim } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { keyframeDelta } from '@/lib/timeline';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/Slider';

/** Keyframes closer than this (clip-local seconds) read as "at the playhead". */
const EPS = 0.02;

const chip = (on: boolean) =>
  cn(
    'rounded-xl border px-2 py-2 text-xs font-medium transition-colors',
    on
      ? 'border-brand bg-brand/10 text-ink'
      : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
  );

interface Chip {
  label: string;
  tone: 'move' | 'scale' | 'muted';
}

function pct(n: number): number {
  return Math.round(n * 100);
}

export function AnimationTool() {
  const activeId = useEditorStore((s) => s.activeClipId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const clips = useEditorStore((s) => s.clips);
  const updateClips = useEditorStore((s) => s.updateClips);
  const currentTime = useEditorStore((s) => s.playback.currentTime);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setActiveClip = useEditorStore((s) => s.setActiveClip);
  const addKeyframeAtPlayhead = useEditorStore((s) => s.addKeyframeAtPlayhead);
  const removeKeyframe = useEditorStore((s) => s.removeKeyframe);
  const clearKeyframes = useEditorStore((s) => s.clearKeyframes);
  const clip = clips.find((c) => c.id === activeId);

  if (!clip) {
    return (
      <p className="text-sm text-ink-faint">
        Select a media clip on the timeline to animate its position and size with keyframes.
      </p>
    );
  }
  if (clip.text) {
    const anim: TextAnim = clip.textAnim ?? { in: null, out: null, duration: DEFAULT_TEXT_ANIM.duration };
    const setAnim = (patch: Partial<TextAnim>) =>
      updateClips(selectedIds, { textAnim: { ...anim, ...patch } });
    const row = (side: 'in' | 'out', label: string) => (
      <div>
        <div className="mb-2 text-xs font-medium text-ink-muted">{label}</div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setAnim({ [side]: null } as Partial<TextAnim>)} className={chip(anim[side] == null)}>
            None
          </button>
          {TEXT_ANIMS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAnim({ [side]: a.id } as Partial<TextAnim>)}
              className={chip(anim[side] === a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    );
    return (
      <div className="space-y-5">
        <p className="text-xs leading-relaxed text-ink-faint">
          Animate this text as it enters and leaves. The preview matches the burned-in export.
        </p>
        {row('in', 'In')}
        {row('out', 'Out')}
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-ink-muted">Duration</span>
            <span className="font-mono text-ink">{anim.duration.toFixed(2)}s</span>
          </div>
          <Slider
            min={0.1}
            max={2}
            step={0.05}
            value={anim.duration}
            onChange={(v) => setAnim({ duration: v })}
            ariaLabel="Animation duration"
          />
        </div>
        {(anim.in || anim.out) && (
          <button
            onClick={() => updateClips(selectedIds, { textAnim: undefined })}
            className="text-xs text-ink-faint underline-offset-2 hover:text-ink hover:underline"
          >
            Clear animation
          </button>
        )}
      </div>
    );
  }

  const keyframes = clip.keyframes ?? [];
  const localPlayhead = currentTime - clip.start;
  const atPlayhead = keyframes.some((k) => Math.abs(k.at - localPlayhead) < EPS);
  const prevKf = [...keyframes].reverse().find((k) => k.at < localPlayhead - EPS);
  const nextKf = keyframes.find((k) => k.at > localPlayhead + EPS);

  const seek = (at: number) => {
    setPlaying(false);
    setCurrentTime(clip.start + at);
  };
  const selectSeek = (at: number) => {
    setActiveClip(clip.id);
    seek(at);
  };

  const chipsFor = (i: number): Chip[] => {
    if (i === 0) return [{ label: 'Start', tone: 'muted' }];
    const d = keyframeDelta(keyframes[i - 1].rect, keyframes[i].rect);
    if (!d.moved && !d.scaled) return [{ label: 'Hold', tone: 'muted' }];
    const out: Chip[] = [];
    if (d.moved) out.push({ label: 'Move', tone: 'move' });
    if (d.scaled) out.push({ label: 'Scale', tone: 'scale' });
    return out;
  };

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-ink-faint">
        Keyframes animate this clip over time. Park the playhead, add a keyframe, then move the playhead and
        drag the box on the preview to set the next one. Two or more keyframes create motion (zoom, pan, moving
        PiP).
      </p>

      <div className="space-y-2.5 rounded-xl border border-line bg-surface-2/40 p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-ink-muted">
            Transform <span className="text-ink-faint">· position &amp; size</span>
          </div>
          {keyframes.length > 0 && (
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">
              {keyframes.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => prevKf && seek(prevKf.at)}
            disabled={!prevKf}
            title="Previous keyframe"
            aria-label="Jump to previous keyframe"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => addKeyframeAtPlayhead(clip.id)}
            className={cn(
              'flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border text-xs font-medium transition-colors',
              atPlayhead
                ? 'border-accent/60 bg-accent/15 text-ink'
                : 'border-line bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
            )}
          >
            <Diamond size={13} className="text-accent" fill={atPlayhead ? 'currentColor' : 'none'} />
            {atPlayhead ? 'Update keyframe' : 'Add keyframe'}
          </button>
          <button
            onClick={() => nextKf && seek(nextKf.at)}
            disabled={!nextKf}
            title="Next keyframe"
            aria-label="Jump to next keyframe"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {keyframes.length > 0 ? (
          <div className="space-y-1">
            {keyframes.map((k, i) => {
              const here = Math.abs(k.at - localPlayhead) < EPS;
              const cx = pct(k.rect.x + k.rect.w / 2);
              const cy = pct(k.rect.y + k.rect.h / 2);
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-stretch gap-1 rounded-lg border transition-colors',
                    here ? 'border-accent/60 bg-accent/10' : 'border-line bg-surface-2',
                  )}
                >
                  <button
                    onClick={() => selectSeek(k.at)}
                    className="min-w-0 flex-1 px-2 py-1.5 text-left"
                    title="Select and seek to this keyframe"
                  >
                    <div className="flex items-center gap-1.5">
                      <Diamond
                        size={11}
                        className={cn('shrink-0', here ? 'text-accent' : 'text-accent/80')}
                        fill={here ? 'currentColor' : 'none'}
                      />
                      <span className={cn('font-mono text-xs', here ? 'text-ink' : 'text-ink-muted')}>
                        {k.at.toFixed(2)}s
                      </span>
                      <div className="ml-auto flex flex-wrap justify-end gap-1">
                        {chipsFor(i).map((c, j) => (
                          <span
                            key={j}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-medium',
                              c.tone === 'move' && 'bg-brand/15 text-brand-bright',
                              c.tone === 'scale' && 'bg-accent/15 text-accent',
                              c.tone === 'muted' && 'bg-surface-3 text-ink-faint',
                            )}
                          >
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="mt-0.5 pl-[18px] font-mono text-[10px] text-ink-faint">
                      Pos {cx}%, {cy}% · Size {pct(k.rect.w)}%
                    </div>
                  </button>
                  <button
                    onClick={() => removeKeyframe(clip.id, i)}
                    aria-label="Delete keyframe"
                    title="Delete keyframe"
                    className="grid w-7 shrink-0 place-items-center rounded-r-lg text-ink-faint transition-colors hover:bg-surface-3 hover:text-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => clearKeyframes(clip.id)}
              className="mt-1 w-full rounded-lg px-2 py-1 text-xs text-ink-faint transition-colors hover:text-danger"
            >
              Clear all keyframes
            </button>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-ink-faint">
            No keyframes yet. Add one at the playhead to pin this clip&apos;s current placement, then add more
            down the timeline to animate between them.
          </p>
        )}

        {keyframes.length === 1 && (
          <p className="text-xs leading-relaxed text-accent/90">
            Add a second keyframe further along the timeline to see the motion.
          </p>
        )}
      </div>
    </div>
  );
}
