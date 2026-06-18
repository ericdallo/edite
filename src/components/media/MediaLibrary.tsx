import { useRef } from 'react';
import { ImageIcon, Loader2, Plus, Upload, Film } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useImportMedia } from '@/hooks/useImportMedia';
import { formatClock } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export function MediaLibrary() {
  const media = useEditorStore((s) => s.media);
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia);
  const { importFiles, busy, error } = useImportMedia();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void importFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Button variant="secondary" size="sm" className="w-full" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />} Add media
      </Button>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
      )}

      <div className="space-y-2">
        {media.map((m) => (
          <div key={m.id} className="group flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2">
            <div className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-black">
              {m.kind === 'image' ? (
                <img src={m.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={m.url} muted preload="metadata" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-ink">{m.fileName}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                {m.kind === 'image' ? <ImageIcon size={11} /> : <Film size={11} />}
                {m.kind === 'image' ? 'Image' : formatClock(m.duration)}
              </div>
            </div>
            <button
              onClick={() => addClipFromMedia(m.id)}
              title="Add to a new track"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <Plus size={16} />
            </button>
          </div>
        ))}
        {media.length === 0 && <p className="text-sm text-ink-faint">No media yet. Add a video or image to begin.</p>}
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Each item you add lands on its own track. Higher tracks overlay the ones below.
      </p>
    </div>
  );
}
