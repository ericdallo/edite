import { useEffect, useState } from 'react';
import { Captions, Cpu, Loader2, Sparkles, Zap } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { clipTimelineDuration } from '@/lib/timeline';
import { cn } from '@/lib/utils';
import { CAPTION_LANGUAGES, CAPTION_MODELS, type CaptionModelId } from '@/lib/captions/models';
import { decodeClipAudio } from '@/lib/captions/audio';
import { segmentsToCaptionClips } from '@/lib/captions/segments';
import { transcribe } from '@/lib/captions/transcriber';
import { logger } from '@/lib/log';

const selectClass =
  'w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand';

function gpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { gpu?: unknown }).gpu != null;
}

export function CaptionsTool() {
  const clips = useEditorStore((s) => s.clips);
  const media = useEditorStore((s) => s.media);
  const activeId = useEditorStore((s) => s.activeClipId);
  const addCaptionClips = useEditorStore((s) => s.addCaptionClips);

  const [model, setModel] = useState<CaptionModelId>('base');
  const [language, setLanguage] = useState('auto');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState(0);

  // Clear transient messages when the selection changes (e.g. picking a clip).
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
    setDoneCount(0);
    setProgress(0);
    setStage('Preparing audio');
    try {
      const samples = await decodeClipAudio(clipMedia.blob, { in: clip.in, out: clip.out });
      if (samples.length === 0) throw new Error('This clip has no audible audio to transcribe.');

      const segments = await transcribe(samples, {
        model,
        language,
        onProgress: (p) => {
          setStage(p.stage === 'loading' ? 'Downloading model' : 'Transcribing');
          setProgress(p.progress);
        },
      });

      const srcLen = clip.out - clip.in;
      const tlDur = clipTimelineDuration(clip);
      const speed = srcLen > 0 && tlDur > 0 ? srcLen / tlDur : 1;
      const captions = segmentsToCaptionClips(segments, {
        clipStart: clip.start,
        speed,
        clipDuration: tlDur,
        audioDuration: srcLen,
      });
      if (captions.length === 0) throw new Error('No speech was detected in this clip.');

      addCaptionClips(captions);
      setDoneCount(captions.length);
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
        <div className="flex items-center gap-2 text-sm text-ink">
          <Captions className="h-4 w-4 text-brand" />
          <span className="font-medium">Auto-captions</span>
        </div>
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-ink">
        <Captions className="h-4 w-4 text-brand" />
        <span className="font-medium">Auto-captions</span>
      </div>

      {doneCount > 0 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand/40 bg-brand/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <Sparkles className="h-4 w-4 text-brand" />
              Added {doneCount} caption{doneCount === 1 ? '' : 's'}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              They are on a new “Captions” track. Edit the wording or styling of any caption in the Text
              tool, and drag to fine-tune timing.
            </p>
          </div>
          <button
            onClick={() => setDoneCount(0)}
            className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            Caption another clip
          </button>
        </div>
      ) : eligible ? (
        <>
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 text-xs font-medium text-ink-muted">Model</div>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as CaptionModelId)}
                className={selectClass}
                aria-label="Caption model"
              >
                {CAPTION_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.hint} ({m.size})
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

          <button
            onClick={generate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-bright to-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110"
          >
            <Sparkles size={16} /> Generate captions
          </button>

          {error && <p className="text-xs leading-relaxed text-danger">{error}</p>}

          <div className="flex items-center gap-2 text-xs text-ink-faint">
            {gpuAvailable() ? (
              <>
                <Zap size={13} className="text-brand" /> GPU-accelerated (WebGPU)
              </>
            ) : (
              <>
                <Cpu size={13} /> Runs on CPU — the first run can be slow
              </>
            )}
          </div>

          <p className="text-xs leading-relaxed text-ink-faint">
            Transcribes the selected clip on your device with Whisper. Your audio never leaves the browser;
            the only network request is a one-time model download, cached afterwards.
          </p>
        </>
      ) : (
        <>
          {error && <p className="mb-3 text-xs leading-relaxed text-danger">{error}</p>}
          <p className="text-sm text-ink-faint">
            {clip
              ? 'This clip has no audio to transcribe. Select a video or audio clip with sound.'
              : 'Select a video or audio clip with sound to generate captions from it.'}
          </p>
        </>
      )}
    </div>
  );
}
