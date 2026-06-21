import { type DragEvent, useRef, useState } from 'react';
import { AlertCircle, Clapperboard, Gift, Loader2, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { useImportMedia } from '@/hooks/useImportMedia';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface DropzoneProps {
  compact?: boolean;
}

/** Trust chips shown on the empty-state hero. */
const FEATURES = [
  { icon: ShieldCheck, label: 'Private', sub: 'nothing uploaded' },
  { icon: Gift, label: 'Free', sub: 'no account · no watermark' },
  { icon: Sparkles, label: 'Powerful', sub: 'tracks · effects · captions' },
] as const;

export function Dropzone({ compact = false }: DropzoneProps) {
  const { importFiles, busy, error } = useImportMedia();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void importFiles(e.dataTransfer.files);
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
      accept="video/*,image/*,audio/*"
      multiple
      className="hidden"
      onChange={(e) => {
        if (e.target.files) void importFiles(e.target.files);
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
        <span>Drop videos, images or audio here, or click to upload</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-5 sm:p-6">
      {fileInput}
      {/* Soft aurora backdrop for a warmer first impression. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />
      </div>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={pick}
        className={cn(
          'group relative z-10 flex w-full max-w-xl cursor-pointer flex-col items-center rounded-[1.75rem] border px-6 py-10 text-center shadow-xl shadow-black/20 backdrop-blur-sm transition-all duration-200 sm:px-10 sm:py-14',
          dragging
            ? 'scale-[1.01] border-brand/70 bg-brand/10 shadow-2xl shadow-brand/25'
            : 'border-line/70 bg-surface/55 hover:border-brand/40 hover:bg-surface/75',
        )}
      >
        <div className="mb-6 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.25rem] bg-gradient-to-br from-brand to-accent shadow-2xl shadow-brand/40 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
          {busy ? (
            <Loader2 className="animate-spin text-white" size={34} />
          ) : (
            <Clapperboard className="text-white" size={34} />
          )}
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.7rem]">
          {busy ? 'Reading your files…' : dragging ? 'Drop to import' : 'Make something great'}
        </h1>
        <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-ink-muted">
          {busy
            ? 'Hang tight — this stays on your device.'
            : 'Drop a video, image or audio to start. Multi-track timeline, effects, captions and export — right in your browser.'}
        </p>

        {!busy && (
          <>
            <Button
              variant="primary"
              size="lg"
              className="mt-7 gap-2"
              onClick={(e) => {
                e.stopPropagation();
                pick();
              }}
            >
              <UploadCloud size={18} /> Choose files
            </Button>
            <p className="mt-3 text-xs text-ink-faint">or drag &amp; drop anywhere in this box</p>
          </>
        )}

        <div className="mt-8 grid w-full max-w-md grid-cols-3 gap-2">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-1 rounded-xl border border-line/60 bg-surface-2/50 px-2 py-3"
            >
              <f.icon size={18} className="text-brand-bright" />
              <span className="text-[11px] font-semibold text-ink">{f.label}</span>
              <span className="text-[10px] leading-tight text-ink-faint">{f.sub}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 font-mono text-[10px] tracking-wide text-ink-faint">
          MP4 · WEBM · MOV · PNG · JPG · MP3 · WAV
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
