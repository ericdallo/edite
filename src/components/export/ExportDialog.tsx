import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Loader2, Volume2, VolumeX } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import {
  ASPECT_RATIOS,
  AUDIO_BITRATES,
  canvasSize,
  EXPORT_PRESETS,
  type ExportFormat,
  type ExportPreset,
  type ExportQuality,
  FPS_PRESETS,
  isAudioFormat,
  RECOMMENDED_VIDEO_KBPS,
  RESOLUTIONS,
  resolveAspectRatio,
} from '@/types/editor';
import { projectDuration } from '@/lib/timeline';
import { estimateExportBytes } from '@/lib/export/estimate';
import { ExportCancelledError, runExport, type MultiExportParams } from '@/lib/ffmpeg/operations';
import { buildExportPlan } from '@/lib/ffmpeg/plan';
import { useFfmpeg } from '@/hooks/useFfmpeg';
import { logger } from '@/lib/log';
import { clamp, cn, formatBytes, formatClock, formatTime } from '@/lib/utils';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

type Stage = 'idle' | 'loading' | 'processing' | 'done' | 'error';

const VIDEO_FORMATS: { id: ExportFormat; label: string; note: string }[] = [
  { id: 'mp4', label: 'MP4', note: 'Best compatibility' },
  { id: 'webm', label: 'WebM', note: 'Smaller, open' },
  { id: 'gif', label: 'GIF', note: 'Silent loop' },
];
const AUDIO_FORMATS: { id: ExportFormat; label: string; note: string }[] = [
  { id: 'mp3', label: 'MP3', note: 'Audio only' },
  { id: 'wav', label: 'WAV', note: 'Lossless audio' },
];
const COMPRESSION: { id: ExportQuality; label: string; hint: string }[] = [
  { id: 'high', label: 'Best', hint: 'Highest quality' },
  { id: 'medium', label: 'Balanced', hint: 'Recommended' },
  { id: 'low', label: 'Smaller', hint: 'Smallest size' },
];

function Status({
  icon,
  text,
  tone = 'muted',
}: {
  icon: ReactNode;
  text: string;
  tone?: 'muted' | 'success' | 'danger';
}) {
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

function Section({ label, children, aside }: { label: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-ink-muted">{label}</div>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const media = useEditorStore((s) => s.media);
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const aspect = useEditorStore((s) => s.aspect);
  const background = useEditorStore((s) => s.background);
  const projectName = useEditorStore((s) => s.projectName);
  const exportSettings = useEditorStore((s) => s.exportSettings);
  const setExportSettings = useEditorStore((s) => s.setExportSettings);
  const setAspect = useEditorStore((s) => s.setAspect);

  const { ensureLoaded } = useFfmpeg();
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Tick an elapsed-time counter while rendering (no ETA is possible on the
  // single-thread WASM core, so we show elapsed instead).
  useEffect(() => {
    if (stage !== 'processing') return;
    const t0 = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((Date.now() - t0) / 1000), 250);
    return () => window.clearInterval(id);
  }, [stage]);

  if (clips.length === 0) return null;

  const { format, resolution, fps, quality, audio, audioBitrate, videoBitrate } = exportSettings;
  const isAudio = isAudioFormat(format);
  const isGif = format === 'gif';
  const { width: canvasW, height: canvasH } = canvasSize(resolveAspectRatio(aspect, media), resolution);
  const duration = projectDuration(clips);
  const audioOn = audio && !isGif;
  const baseName = (nameInput.trim() || projectName || 'edite').replace(/[^\w.-]+/g, '_');
  const fileName = `${baseName}.${format}`;
  const busy = stage === 'loading' || stage === 'processing';
  const visibleClips = clips.filter((c) => !c.hidden && !tracks.find((t) => t.id === c.trackId)?.hidden);
  const hasProjectAudio = visibleClips.some(
    (c) => !c.muted && !!media.find((m) => m.id === c.mediaId)?.hasAudio,
  );
  const canExport = isAudio
    ? duration > 0 && hasProjectAudio
    : visibleClips.length > 0 && duration > 0;
  const customBitrate = !!(videoBitrate && videoBitrate > 0);
  const heavy = resolution >= 1440;
  const estBytes = estimateExportBytes({
    width: canvasW,
    height: canvasH,
    fps,
    duration,
    format,
    quality,
    audio: audioOn,
    audioBitrate,
    videoBitrate,
  });

  const presetActive = (p: ExportPreset) => aspect === p.aspect && resolution === p.resolution && fps === p.fps;
  const applyPreset = (p: ExportPreset) => {
    setAspect(p.aspect);
    setExportSettings({ resolution: p.resolution, fps: p.fps });
  };

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
        fps,
        duration,
        clips: plan.clips,
        format,
        quality,
        audioBitrate,
        videoBitrate,
        globalMuted: !audio,
        background,
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

  const chip = (active: boolean) =>
    cn(
      'rounded-xl border px-3 py-2 text-center transition-colors',
      active ? 'border-brand bg-brand/10 text-ink' : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
      busy && 'opacity-60',
    );

  const formatButton = (f: { id: ExportFormat; label: string; note: string }) => (
    <button
      key={f.id}
      disabled={busy}
      onClick={() => setExportSettings({ format: f.id })}
      className={cn(
        'rounded-xl border px-3 py-2.5 text-left transition-colors',
        format === f.id ? 'border-brand bg-brand/10' : 'border-line bg-surface-2 hover:bg-surface-3',
        busy && 'opacity-60',
      )}
    >
      <div className="text-sm font-semibold text-ink">{f.label}</div>
      <div className="text-[11px] text-ink-faint">{f.note}</div>
    </button>
  );

  return (
    <Dialog
      open={open}
      onClose={close}
      title={isAudio ? 'Export audio' : 'Export video'}
      subtitle={busy ? undefined : 'Rendered on your device — nothing is uploaded.'}
      dismissable={!busy}
    >
      <div className="space-y-5">
        {!isAudio && (
          <Section label="Preset">
            <div className="flex flex-wrap gap-2">
              {EXPORT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  disabled={busy}
                  onClick={() => applyPreset(p)}
                  title={p.hint}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left transition-colors',
                    presetActive(p) ? 'border-brand bg-brand/10' : 'border-line bg-surface-2 hover:bg-surface-3',
                    busy && 'opacity-60',
                  )}
                >
                  <div className="text-xs font-semibold text-ink">{p.label}</div>
                  <div className="text-[10px] text-ink-faint">{p.hint}</div>
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section label="Format">
          <div className="grid grid-cols-3 gap-2">{VIDEO_FORMATS.map(formatButton)}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">{AUDIO_FORMATS.map(formatButton)}</div>
        </Section>

        {isAudio ? (
          format === 'mp3' ? (
            <Section label="Audio bitrate">
              <div className="grid grid-cols-4 gap-2">
                {AUDIO_BITRATES.map((b) => (
                  <button
                    key={b}
                    disabled={busy}
                    onClick={() => setExportSettings({ audioBitrate: b })}
                    className={cn(chip(audioBitrate === b), 'px-1 py-2 text-sm font-medium')}
                  >
                    {b}k
                  </button>
                ))}
              </div>
            </Section>
          ) : (
            <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs text-ink-faint">
              WAV is exported as uncompressed 16-bit PCM — lossless, but large files.
            </p>
          )
        ) : (
          <>
            <Section label="Aspect ratio">
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => setAspect('original')}
                  className={cn(chip(aspect === 'original'), 'px-3 py-1.5 text-sm')}
                >
                  Original
                </button>
                {ASPECT_RATIOS.map((a) => (
                  <button
                    key={a.id}
                    disabled={busy}
                    onClick={() => setAspect(a.id)}
                    title={a.hint}
                    className={cn(chip(aspect === a.id), 'px-3 py-1.5 text-sm')}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Resolution">
              <div className="grid grid-cols-5 gap-2">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r.id}
                    disabled={busy}
                    onClick={() => setExportSettings({ resolution: r.id })}
                    className={cn(
                      'rounded-xl border px-1.5 py-2 text-center transition-colors',
                      resolution === r.id ? 'border-brand bg-brand/10' : 'border-line bg-surface-2 hover:bg-surface-3',
                      busy && 'opacity-60',
                    )}
                  >
                    <div className="text-sm font-semibold text-ink">{r.label}</div>
                    <div className="text-[10px] text-ink-faint">{r.hint}</div>
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Frame rate">
              <div className="grid grid-cols-5 gap-2">
                {FPS_PRESETS.map((f) => (
                  <button
                    key={f}
                    disabled={busy}
                    onClick={() => setExportSettings({ fps: f })}
                    className={cn(chip(fps === f), 'px-1 py-2 text-sm font-medium')}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </Section>

            <Section
              label="Compression"
              aside={customBitrate ? <span className="text-[11px] text-ink-faint">Using custom bitrate</span> : undefined}
            >
              <div className={cn('grid grid-cols-3 gap-2', customBitrate && 'opacity-50')}>
                {COMPRESSION.map((q) => (
                  <button
                    key={q.id}
                    disabled={busy || customBitrate}
                    onClick={() => setExportSettings({ quality: q.id })}
                    className={cn(chip(quality === q.id && !customBitrate))}
                  >
                    <div className="text-sm font-medium">{q.label}</div>
                    <div className="text-[10px] text-ink-faint">{q.hint}</div>
                  </button>
                ))}
              </div>
            </Section>

            <div className="rounded-xl border border-line bg-surface-2">
              <button
                disabled={busy}
                onClick={() => setAdvanced((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-60"
              >
                <span>Advanced</span>
                <ChevronDown size={16} className={cn('transition-transform', advanced && 'rotate-180')} />
              </button>
              {advanced && (
                <div className="space-y-4 border-t border-line px-4 py-4">
                  {isGif ? (
                    <p className="text-xs text-ink-faint">
                      GIF is always silent and exported with an optimised color palette. Switch to MP4 or WebM for
                      audio and bitrate controls.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm text-ink">Audio</div>
                          <div className="text-[11px] text-ink-faint">Include the mixed soundtrack</div>
                        </div>
                        <button
                          disabled={busy}
                          onClick={() => setExportSettings({ audio: !audio })}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                            audio
                              ? 'border-brand bg-brand/10 text-ink'
                              : 'border-line bg-surface-3 text-ink-muted hover:text-ink',
                            busy && 'opacity-60',
                          )}
                        >
                          {audio ? <Volume2 size={14} /> : <VolumeX size={14} />}
                          {audio ? 'On' : 'Off'}
                        </button>
                      </div>

                      <div className={cn(!audio && 'pointer-events-none opacity-40')}>
                        <div className="mb-1.5 text-[11px] font-medium text-ink-faint">Audio bitrate</div>
                        <div className="grid grid-cols-4 gap-2">
                          {AUDIO_BITRATES.map((b) => (
                            <button
                              key={b}
                              disabled={busy || !audio}
                              onClick={() => setExportSettings({ audioBitrate: b })}
                              className={cn(chip(audioBitrate === b), 'px-1 py-1.5 text-xs font-medium')}
                            >
                              {b}k
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                        <div>
                          <div className="text-sm text-ink">Custom video bitrate</div>
                          <div className="text-[11px] text-ink-faint">Target a size — overrides Compression</div>
                        </div>
                        <button
                          disabled={busy}
                          onClick={() =>
                            setExportSettings({
                              videoBitrate: customBitrate ? undefined : RECOMMENDED_VIDEO_KBPS[resolution],
                            })
                          }
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                            customBitrate
                              ? 'border-brand bg-brand/10 text-ink'
                              : 'border-line bg-surface-3 text-ink-muted hover:text-ink',
                            busy && 'opacity-60',
                          )}
                        >
                          {customBitrate ? 'On' : 'Off'}
                        </button>
                      </div>
                      {customBitrate && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0.2}
                            max={200}
                            step={0.5}
                            disabled={busy}
                            value={Math.round(((videoBitrate ?? 0) / 1000) * 10) / 10}
                            onChange={(e) =>
                              setExportSettings({
                                videoBitrate: Math.round(clamp(Number(e.target.value) || 0, 0.2, 200) * 1000),
                              })
                            }
                            className="w-28 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-brand"
                          />
                          <span className="text-sm text-ink-muted">Mbps</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        <Section label="File name">
          <div className="flex items-center rounded-xl border border-line bg-surface-2 px-3 focus-within:border-brand">
            <input
              type="text"
              disabled={busy}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={projectName || 'edite'}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint"
            />
            <span className="shrink-0 pl-2 font-mono text-xs text-ink-faint">.{format}</span>
          </div>
        </Section>

        <div className="space-y-1.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="text-ink-muted">Output</div>
            <div className="flex items-center gap-2.5 font-mono text-xs text-ink">
              <span>{formatTime(duration)}</span>
              {isAudio ? (
                <>
                  <span className="text-ink-faint">·</span>
                  <span>{format.toUpperCase()}</span>
                  {format === 'mp3' && (
                    <>
                      <span className="text-ink-faint">·</span>
                      <span>{audioBitrate}k</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="text-ink-faint">·</span>
                  <span>
                    {canvasW}×{canvasH}
                  </span>
                  <span className="text-ink-faint">·</span>
                  <span>{fps} fps</span>
                  <span className="text-ink-faint">·</span>
                  <span>{audioOn ? `audio ${audioBitrate}k` : 'no audio'}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-ink-muted">Estimated size</div>
            <div className="font-mono text-xs text-ink">~{formatBytes(estBytes)}</div>
          </div>
        </div>

        {isAudio && !hasProjectAudio && stage === 'idle' && (
          <p className="text-[11px] text-ink-faint">This project has no audio to export.</p>
        )}

        {!isAudio && heavy && stage === 'idle' && (
          <p className="text-[11px] text-ink-faint">
            {resolution >= 2160 ? '4K' : '2K'} renders on-device and can take a while — there's no hardware
            acceleration in the browser engine.
          </p>
        )}

        {stage === 'loading' && (
          <Status icon={<Loader2 className="animate-spin" size={16} />} text="Loading the video engine (one-time, ~32 MB)…" />
        )}
        {stage === 'processing' && (
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-ink-muted">
              <span>Rendering… {formatClock(elapsed)}</span>
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
          <Status
            tone="success"
            icon={<CheckCircle2 size={16} />}
            text={`Done — ${formatBytes(result.size)}. Your download should have started.`}
          />
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
                    <Download size={16} /> Export {format.toUpperCase()}
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
