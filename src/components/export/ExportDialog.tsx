import { type ReactNode, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import {
  canvasSize,
  resolveAspectRatio,
  type ExportFormat,
  type ExportQuality,
  FPS_PRESETS,
  RESOLUTIONS,
} from '@/types/editor';
import { projectDuration } from '@/lib/timeline';
import { ExportCancelledError, runExport, type MultiExportParams } from '@/lib/ffmpeg/operations';
import { buildExportPlan } from '@/lib/ffmpeg/plan';
import { useFfmpeg } from '@/hooks/useFfmpeg';
import { logger } from '@/lib/log';
import { cn, formatBytes, formatTime } from '@/lib/utils';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

type Stage = 'idle' | 'loading' | 'processing' | 'done' | 'error';

const FORMATS: { id: ExportFormat; label: string; note: string }[] = [
  { id: 'mp4', label: 'MP4', note: 'Best compatibility' },
  { id: 'webm', label: 'WebM', note: 'Smaller, open' },
  { id: 'gif', label: 'GIF', note: 'Silent loop' },
];
const COMPRESSION: { id: ExportQuality; label: string; hint: string }[] = [
  { id: 'high', label: 'Best', hint: 'Highest quality' },
  { id: 'medium', label: 'Balanced', hint: 'Recommended' },
  { id: 'low', label: 'Smaller', hint: 'Smallest size' },
];

function Status({ icon, text, tone = 'muted' }: { icon: ReactNode; text: string; tone?: 'muted' | 'success' | 'danger' }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-4 py-3 text-sm',
        tone === 'success'
          ? 'border-success/30 bg-success/10 text-success'
          : tone === 'danger'
            ? 'border-danger/30 bg-danger/10 text-danger'
            : 'border-line bg-surface-2 text-ink-muted',
      )}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const media = useEditorStore((s) => s.media);
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const aspect = useEditorStore((s) => s.aspect);
  const muted = useEditorStore((s) => s.muted);
  const projectName = useEditorStore((s) => s.projectName);
  const exportSettings = useEditorStore((s) => s.exportSettings);
  const setExportSettings = useEditorStore((s) => s.setExportSettings);

  const { ensureLoaded } = useFfmpeg();
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  if (media.length === 0) return null;

  const { width: canvasW, height: canvasH } = canvasSize(resolveAspectRatio(aspect, media), exportSettings.resolution);
  const duration = projectDuration(clips);
  const fileName = `${(projectName || 'edite').replace(/[^\w.-]+/g, '_')}.${exportSettings.format}`;
  const busy = stage === 'loading' || stage === 'processing';
  const visibleClips = clips.filter(
    (c) => !c.hidden && !tracks.find((t) => t.id === c.trackId)?.hidden,
  );
  const canExport = visibleClips.length > 0 && duration > 0;

  const doDownload = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const start = async () => {
    setError(null);
    setProgress(0);
    if (result) {
      URL.revokeObjectURL(result.url);
      setResult(null);
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setStage('loading');
      await ensureLoaded();
      if (controller.signal.aborted) throw new ExportCancelledError();
      setStage('processing');

      const plan = buildExportPlan(tracks, clips, media);
      const params: MultiExportParams = {
        canvasW,
        canvasH,
        fps: exportSettings.fps,
        duration,
        clips: plan.clips,
        format: exportSettings.format,
        quality: exportSettings.quality,
        globalMuted: muted,
      };

      const out = await runExport({
        params,
        media: plan.media,
        clipMediaIds: plan.clipMediaIds,
        signal: controller.signal,
        onProgress: setProgress,
      });
      const url = URL.createObjectURL(out);
      setResult({ url, size: out.size });
      setStage('done');
      doDownload(url);
    } catch (e) {
      if (e instanceof ExportCancelledError) {
        setStage('idle');
        setProgress(0);
        return;
      }
      logger.error('export failed in dialog:', e);
      setError(e instanceof Error ? e.message : 'Export failed — see the browser console for details.');
      setStage('error');
    } finally {
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const close = () => {
    if (busy) return;
    onClose();
    setTimeout(() => {
      setStage('idle');
      setProgress(0);
      setError(null);
    }, 200);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Export video"
      subtitle={busy ? undefined : 'Rendered on your device — nothing is uploaded.'}
      dismissable={!busy}
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-sm font-medium text-ink-muted">Format</div>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                disabled={busy}
                onClick={() => setExportSettings({ format: f.id })}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-left transition-colors',
                  exportSettings.format === f.id ? 'border-brand bg-brand/10' : 'border-line bg-surface-2 hover:bg-surface-3',
                  busy && 'opacity-60',
                )}
              >
                <div className="text-sm font-semibold text-ink">{f.label}</div>
                <div className="text-[11px] text-ink-faint">{f.note}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-ink-muted">Resolution</div>
          <div className="grid grid-cols-5 gap-2">
            {RESOLUTIONS.map((r) => (
              <button
                key={r.id}
                disabled={busy}
                onClick={() => setExportSettings({ resolution: r.id })}
                className={cn(
                  'rounded-xl border px-1.5 py-2 text-center transition-colors',
                  exportSettings.resolution === r.id ? 'border-brand bg-brand/10' : 'border-line bg-surface-2 hover:bg-surface-3',
                  busy && 'opacity-60',
                )}
              >
                <div className="text-sm font-semibold text-ink">{r.label}</div>
                <div className="text-[10px] text-ink-faint">{r.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-ink-muted">Frame rate</div>
          <div className="grid grid-cols-3 gap-2">
            {FPS_PRESETS.map((f) => (
              <button
                key={f}
                disabled={busy}
                onClick={() => setExportSettings({ fps: f })}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  exportSettings.fps === f ? 'border-brand bg-brand/10 text-ink' : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
                  busy && 'opacity-60',
                )}
              >
                {f} fps
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium text-ink-muted">Compression</div>
          <div className="grid grid-cols-3 gap-2">
            {COMPRESSION.map((q) => (
              <button
                key={q.id}
                disabled={busy}
                onClick={() => setExportSettings({ quality: q.id })}
                className={cn(
                  'rounded-xl border px-3 py-2 text-center transition-colors',
                  exportSettings.quality === q.id ? 'border-brand bg-brand/10 text-ink' : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
                  busy && 'opacity-60',
                )}
              >
                <div className="text-sm font-medium">{q.label}</div>
                <div className="text-[10px] text-ink-faint">{q.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
          <div className="text-ink-muted">Output</div>
          <div className="flex items-center gap-2.5 font-mono text-xs text-ink">
            <span>{formatTime(duration)}</span>
            <span className="text-ink-faint">·</span>
            <span>{canvasW}×{canvasH}</span>
            <span className="text-ink-faint">·</span>
            <span>{exportSettings.fps} fps</span>
            <span className="text-ink-faint">·</span>
            <span>{exportSettings.format === 'gif' || muted ? 'no audio' : 'audio'}</span>
          </div>
        </div>

        {stage === 'loading' && (
          <Status icon={<Loader2 className="animate-spin" size={16} />} text="Loading the video engine (one-time, ~32 MB)…" />
        )}
        {stage === 'processing' && (
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-ink-muted">
              <span>Rendering…</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-[width] duration-200"
                style={{ width: `${Math.max(3, progress * 100)}%` }}
              />
            </div>
          </div>
        )}
        {stage === 'done' && result && (
          <Status tone="success" icon={<CheckCircle2 size={16} />} text={`Done — ${formatBytes(result.size)}. Your download should have started.`} />
        )}
        {stage === 'error' && <Status tone="danger" icon={<AlertTriangle size={16} />} text={error ?? 'Export failed.'} />}

        <div className="flex items-center justify-end gap-2 pt-1">
          {stage === 'done' && result ? (
            <>
              <Button variant="subtle" onClick={() => doDownload(result.url)}>
                Download again
              </Button>
              <Button variant="primary" onClick={close}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={busy ? cancel : close}>
                {busy ? 'Cancel export' : 'Cancel'}
              </Button>
              <Button variant="primary" onClick={start} disabled={busy || !canExport}>
                {busy ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Working…
                  </>
                ) : (
                  <>
                    <Download size={16} /> Export {exportSettings.format.toUpperCase()}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
