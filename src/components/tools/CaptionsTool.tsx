import { useEffect, useMemo, useState } from 'react';
import {
  Captions,
  ChevronDown,
  ChevronRight,
  Combine,
  Cpu,
  Loader2,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { clipTimelineDuration } from '@/lib/timeline';
import { cn } from '@/lib/utils';
import {
  CAPTION_PRESETS,
  captionRect,
  type CaptionPosition,
  type Clip,
  isCaptionClip,
} from '@/types/editor';
import { TEXT_SIZE_MAX, TEXT_SIZE_MIN } from '@/lib/constants';
import { Slider } from '@/components/ui/Slider';
import { CAPTION_LANGUAGES, CAPTION_MODELS, type CaptionModelId } from '@/lib/captions/models';
import { decodeClipAudio } from '@/lib/captions/audio';
import {
  CAPTION_LENGTH_OPTIONS,
  type CaptionLength,
  groupWordsIntoLines,
  lineOptionsFor,
  segmentsToCaptionClips,
} from '@/lib/captions/segments';
import { transcribe } from '@/lib/captions/transcriber';
import { logger } from '@/lib/log';

type CaptionClip = Clip & { text: NonNullable<Clip['text']>; caption: NonNullable<Clip['caption']> };

const selectClass =
  'w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand';

const COLOR_SWATCHES = ['#ffffff', '#fbbf24', '#22d3ee', '#8b5cf6', '#34d399', '#f43f5e', '#000000'];

function gpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { gpu?: unknown }).gpu != null;
}

/** Compact timecode like `1:05.3`. */
function fmtTime(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function CaptionsTool() {
  const clips = useEditorStore((s) => s.clips);
  const media = useEditorStore((s) => s.media);
  const activeId = useEditorStore((s) => s.activeClipId);
  const addCaptionClips = useEditorStore((s) => s.addCaptionClips);

  const captions = useMemo(
    () => clips.filter(isCaptionClip).sort((a, b) => a.start - b.start) as CaptionClip[],
    [clips],
  );

  const hasGpu = gpuAvailable();
  const [model, setModel] = useState<CaptionModelId>(() => (hasGpu ? 'small' : 'base'));
  const [language, setLanguage] = useState('auto');
  const [length, setLength] = useState<CaptionLength>('line');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // When captions already exist, the generate controls are tucked away.
  const [showGenerate, setShowGenerate] = useState(false);

  useEffect(() => {
    setError(null);
  }, [activeId]);

  const clip = clips.find((c) => c.id === activeId);
  const clipMedia = clip ? media.find((m) => m.id === clip.mediaId) : undefined;
  const eligible =
    !!clip &&
    !clip.text &&
    clip.freeze == null &&
    (clipMedia?.kind === 'audio' || (clipMedia?.kind === 'video' && clipMedia.hasAudio));

  async function generate() {
    if (!clip || !clipMedia || busy) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    setStage('Preparing audio');
    try {
      const samples = await decodeClipAudio(clipMedia.blob, { in: clip.in, out: clip.out });
      if (samples.length === 0) throw new Error('This clip has no audible audio to transcribe.');

      const { segments, wordLevel } = await transcribe(samples, {
        model,
        language,
        onProgress: (p) => {
          setStage(p.stage === 'loading' ? 'Downloading model' : 'Transcribing');
          setProgress(p.progress);
        },
      });

      const lines = wordLevel ? groupWordsIntoLines(segments, lineOptionsFor(length)) : segments;
      const srcLen = clip.out - clip.in;
      const tlDur = clipTimelineDuration(clip);
      const speed = srcLen > 0 && tlDur > 0 ? srcLen / tlDur : 1;
      const newCaptions = segmentsToCaptionClips(lines, {
        clipStart: clip.start,
        speed,
        clipDuration: tlDur,
        audioDuration: srcLen,
      });
      if (newCaptions.length === 0) throw new Error('No speech was detected in this clip.');

      addCaptionClips(newCaptions);
      setShowGenerate(false);
    } catch (e) {
      logger.error('caption generation failed', e);
      setError(e instanceof Error ? e.message : 'Could not generate captions.');
    } finally {
      setBusy(false);
      setStage('');
      setProgress(0);
    }
  }

  if (busy) {
    const pct = Math.round(progress * 100);
    return (
      <div className="space-y-5">
        <Heading />
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="mb-3 flex items-center gap-2.5 text-sm font-medium text-ink">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            {stage || 'Working'}
            {stage === 'Downloading model' && <span className="ml-auto font-mono text-ink-muted">{pct}%</span>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn('h-full rounded-full bg-brand transition-all', stage === 'Transcribing' && 'animate-pulse')}
              style={{ width: stage === 'Transcribing' ? '100%' : `${pct}%` }}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            Running entirely on your device. The model downloads once, then it is cached for next time.
          </p>
        </div>
      </div>
    );
  }

  const generateControls = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1.5 text-xs font-medium text-ink-muted">Model</div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as CaptionModelId)}
            className={selectClass}
            aria-label="Caption model"
          >
            {CAPTION_MODELS.map((m) => (
              <option key={m.id} value={m.id} disabled={m.gpuOnly && !hasGpu}>
                {m.label} — {m.hint} ({m.size})
                {m.gpuOnly && !hasGpu ? ' · needs GPU' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-ink-muted">Language</div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={selectClass}
            aria-label="Spoken language"
          >
            {CAPTION_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium text-ink-muted">Caption length</div>
        <select
          value={length}
          onChange={(e) => setLength(e.target.value as CaptionLength)}
          className={selectClass}
          aria-label="Caption length"
        >
          {CAPTION_LENGTH_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} — {o.hint}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={generate}
        disabled={!eligible}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-bright to-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles size={16} /> Generate captions
      </button>

      {!eligible && (
        <p className="text-xs leading-relaxed text-ink-faint">
          {clip
            ? 'This clip has no audio. Select a video or audio clip with sound.'
            : 'Select a video or audio clip with sound to caption it.'}
        </p>
      )}
      {error && <p className="text-xs leading-relaxed text-danger">{error}</p>}

      <div className="flex items-center gap-2 text-xs text-ink-faint">
        {hasGpu ? (
          <>
            <Zap size={13} className="text-brand" /> GPU-accelerated (WebGPU)
          </>
        ) : (
          <>
            <Cpu size={13} /> Runs on CPU — larger models are slower
          </>
        )}
      </div>
      <p className="text-xs leading-relaxed text-ink-faint">
        Transcribed on your device with Whisper. Your audio never leaves the browser; the only network
        request is a one-time model download, cached afterwards.
      </p>
    </div>
  );

  return (
    <div className="space-y-5">
      <Heading />

      {captions.length > 0 ? (
        <>
          <CaptionStyleBar captions={captions} />
          <CaptionList captions={captions} />

          <div>
            <button
              onClick={() => setShowGenerate((v) => !v)}
              className="flex w-full items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              {showGenerate ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              Transcribe another clip
            </button>
            {showGenerate && <div className="mt-3">{generateControls}</div>}
          </div>
        </>
      ) : (
        generateControls
      )}
    </div>
  );
}

function Heading() {
  return (
    <div className="flex items-center gap-2 text-sm text-ink">
      <Captions className="h-4 w-4 text-brand" />
      <span className="font-medium">Auto-captions</span>
    </div>
  );
}

function CaptionList({ captions }: { captions: CaptionClip[] }) {
  const activeId = useEditorStore((s) => s.activeClipId);
  const setActiveClip = useEditorStore((s) => s.setActiveClip);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const updateText = useEditorStore((s) => s.updateText);
  const deleteClips = useEditorStore((s) => s.deleteClips);
  const mergeCaptionWithNext = useEditorStore((s) => s.mergeCaptionWithNext);

  const seek = (c: CaptionClip) => {
    setActiveClip(c.id);
    setPlaying(false);
    setCurrentTime(c.start);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
        <span>{captions.length} captions</span>
        <span className="text-ink-faint">click a time to jump</span>
      </div>
      <ul className="space-y-1.5">
        {captions.map((c, i) => (
          <li
            key={c.id}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors',
              c.id === activeId ? 'border-brand/60 bg-brand/10' : 'border-line bg-surface-2',
            )}
          >
            <button
              onClick={() => seek(c)}
              className="shrink-0 rounded-md bg-surface-3 px-1.5 py-1 font-mono text-[11px] text-ink-muted transition-colors hover:text-brand"
              title="Jump to this caption"
            >
              {fmtTime(c.start)}
            </button>
            <input
              value={c.text.content}
              onChange={(e) => updateText(c.id, { content: e.target.value })}
              onFocus={() => setActiveClip(c.id)}
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink outline-none transition-colors focus:border-brand/60 focus:bg-surface"
              aria-label={`Caption at ${fmtTime(c.start)}`}
            />
            <button
              onClick={() => mergeCaptionWithNext(c.id)}
              disabled={i === captions.length - 1}
              className="shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              title="Merge with next caption"
              aria-label="Merge with next caption"
            >
              <Combine size={14} />
            </button>
            <button
              onClick={() => deleteClips([c.id])}
              className="shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-danger/15 hover:text-danger"
              title="Delete caption"
              aria-label="Delete caption"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CaptionStyleBar({ captions }: { captions: CaptionClip[] }) {
  const styleCaptions = useEditorStore((s) => s.styleCaptions);
  const base = captions[0].text;
  const pos: CaptionPosition = captions[0].rect.y < 0.2 ? 'top' : captions[0].rect.y < 0.5 ? 'center' : 'bottom';

  const positions: { id: CaptionPosition; label: string }[] = [
    { id: 'top', label: 'Top' },
    { id: 'center', label: 'Middle' },
    { id: 'bottom', label: 'Bottom' },
  ];

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-3">
      <div className="text-xs font-medium text-ink-muted">Style all captions</div>

      <div className="grid grid-cols-4 gap-1.5">
        {CAPTION_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => styleCaptions(p.style)}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-brand/60 hover:text-ink"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {positions.map((p) => (
          <button
            key={p.id}
            onClick={() => styleCaptions({}, captionRect(p.id))}
            aria-pressed={pos === p.id}
            className={cn(
              'rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
              pos === p.id
                ? 'border-brand bg-brand/15 text-ink'
                : 'border-line bg-surface text-ink-muted hover:text-ink',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {COLOR_SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => styleCaptions({ color: c })}
            aria-label={`Caption color ${c}`}
            className={cn(
              'h-6 w-6 rounded-full border transition-transform hover:scale-110',
              base.color.toLowerCase() === c ? 'border-white ring-2 ring-brand' : 'border-black/40',
            )}
            style={{ background: c }}
          />
        ))}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-ink-muted">Size</span>
          <span className="font-mono text-ink">{Math.round(base.fontSize * 1080)}px</span>
        </div>
        <Slider
          min={TEXT_SIZE_MIN}
          max={TEXT_SIZE_MAX}
          step={0.005}
          value={base.fontSize}
          onChange={(v) => styleCaptions({ fontSize: v })}
          ariaLabel="Caption size"
        />
      </div>
    </div>
  );
}
