import { type DragEvent, useRef, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck, UploadCloud } from 'lucide-react';
import { useImportMedia } from '@/hooks/useImportMedia';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface DropzoneProps {
  compact?: boolean;
}

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
    <div className="flex h-full w-full items-center justify-center p-6">
      {fileInput}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={pick}
        className={cn(
          'group relative flex w-full max-w-2xl cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all sm:px-8 sm:py-16',
          dragging ? 'scale-[1.01] border-brand bg-brand/5' : 'border-line bg-surface/40 hover:border-surface-3 hover:bg-surface/70',
        )}
      >
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-accent shadow-xl shadow-brand/30 transition-transform group-hover:scale-105 sm:mb-6 sm:h-20 sm:w-20">
          {busy ? <Loader2 className="animate-spin text-white" size={32} /> : <UploadCloud className="text-white" size={32} />}
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {busy ? 'Reading your files…' : 'Drop videos, images or audio to start'}
        </h2>
        <p className="mt-2 max-w-md text-ink-muted">
          Stack clips on multiple tracks, trim, crop, change speed, add overlays and export — all
          right here, with nothing uploaded to a server.
        </p>
        {!busy && (
          <Button variant="primary" size="lg" className="mt-7" onClick={(e) => { e.stopPropagation(); pick(); }}>
            Choose files
          </Button>
        )}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-faint">
          <span>MP4 · WebM · MOV · PNG · JPG · MP3 · WAV</span>
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
