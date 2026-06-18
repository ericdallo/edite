import { type DragEvent, useCallback, useRef, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck, UploadCloud } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { probeVideo } from '@/lib/media/probe';
import { saveMedia, saveSnapshot, setLastProjectId } from '@/lib/storage/projects';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface DropzoneProps {
  compact?: boolean;
}

export function Dropzone({ compact = false }: DropzoneProps) {
  const loadSource = useEditorStore((s) => s.loadSource);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith('video/')) {
        setError('Please choose a video file (MP4, WebM, MOV or MKV).');
        return;
      }
      setBusy(true);
      try {
        const meta = await probeVideo(file);
        const url = URL.createObjectURL(file);
        const id = Math.random().toString(36).slice(2, 10);
        loadSource({ meta, url, blob: file, name: file.name, id });

        // Persist the original media + initial snapshot so reloads restore it.
        const now = Date.now();
        void saveMedia(id, file);
        void saveSnapshot({
          id,
          name: file.name.replace(/\.[^/.]+$/, '') || 'Untitled project',
          createdAt: now,
          updatedAt: now,
          source: meta,
          segments: [{ id: 'seg', start: 0, end: meta.duration }],
          speed: 1,
          muted: false,
          crop: null,
          aspect: 'original',
          aspectMode: 'fill',
          exportSettings: { format: 'mp4', quality: 'high' },
        });
        setLastProjectId(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not open this file.');
      } finally {
        setBusy(false);
      }
    },
    [loadSource],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };
  const pick = () => inputRef.current?.click();

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="video/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void handleFile(f);
        e.target.value = '';
      }}
    />
  );

  if (compact) {
    return (
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={pick}
        className={cn(
          'flex h-full w-full cursor-pointer items-center justify-center gap-2 text-sm transition-colors',
          dragging ? 'text-brand-bright' : 'text-ink-faint hover:text-ink-muted',
        )}
      >
        {fileInput}
        {busy ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
        <span>Drop a video here or click to upload</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      {fileInput}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={pick}
        className={cn(
          'group relative flex w-full max-w-2xl cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-8 py-16 text-center transition-all',
          dragging
            ? 'scale-[1.01] border-brand bg-brand/5'
            : 'border-line bg-surface/40 hover:border-surface-3 hover:bg-surface/70',
        )}
      >
        <div className="mb-6 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-brand to-accent shadow-xl shadow-brand/30 transition-transform group-hover:scale-105">
          {busy ? (
            <Loader2 className="animate-spin text-white" size={32} />
          ) : (
            <UploadCloud className="text-white" size={32} />
          )}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          {busy ? 'Reading your video…' : 'Drop a video to start editing'}
        </h2>
        <p className="mt-2 max-w-md text-ink-muted">
          Trim, split, crop, change speed and aspect ratio, mute and export — all right here, with
          nothing uploaded to a server.
        </p>
        {!busy && (
          <Button
            variant="primary"
            size="lg"
            className="mt-7"
            onClick={(e) => {
              e.stopPropagation();
              pick();
            }}
          >
            Choose a video
          </Button>
        )}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-faint">
          <span>MP4 · WebM · MOV · MKV</span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={14} /> 100% private — processed on your device
          </span>
        </div>
        {error && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </div>
    </div>
  );
}
