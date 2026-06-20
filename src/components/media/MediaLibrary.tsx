import { useRef } from 'react';
import { ImageIcon, Loader2, Music, Plus, Upload, Film } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useImportMedia } from '@/hooks/useImportMedia';
import { cn, formatClock } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export function MediaLibrary() {
  const media = useEditorStore((s) => s.media);
  const clips = useEditorStore((s) => s.clips);
  const addClipFromMedia = useEditorStore((s) => s.addClipFromMedia);
  const setPanelOpen = useEditorStore((s) => s.setPanelOpen);
  const selectClips = useEditorStore((s) => s.selectClips);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const { importFiles, busy, error } = useImportMedia();
  const inputRef = useRef<HTMLInputElement>(null);

  // Select every clip using this media so its usages light up on the timeline,
  // jump to the first one, and close the mobile sheet to reveal the highlight.
  const highlightUsages = (mediaId: string) => {
    const uses = clips.filter((c) => c.mediaId === mediaId);
    if (uses.length === 0) return;
    selectClips(uses.map((c) => c.id));
    setPlaying(false);
    setCurrentTime(Math.min(...uses.map((c) => c.start)));
    setPanelOpen(false);
  };

  return (
    <div className="space-y-4">
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
      <Button variant="secondary" size="sm" className="w-full" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" size={15} /> : <Upload size={15} />} Add media
      </Button>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
      )}

      <div className="space-y-2">
        {media.map((m) => {
          const uses = clips.filter((c) => c.mediaId === m.id).length;
          return (
            <div
              key={m.id}
              onClick={() => highlightUsages(m.id)}
              role={uses > 0 ? 'button' : undefined}
              title={uses > 0 ? 'Highlight its clips on the timeline' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2',
                uses > 0 && 'cursor-pointer hover:border-brand/50',
              )}
            >
              <div className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-black">
                {m.kind === 'image' ? (
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                ) : m.kind === 'audio' ? (
                  <Music size={18} className="text-brand-bright" />
                ) : (
                  <video src={m.url} muted preload="metadata" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-ink">{m.fileName}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
                  {m.kind === 'image' ? (
                    <ImageIcon size={11} />
                  ) : m.kind === 'audio' ? (
                    <Music size={11} />
                  ) : (
                    <Film size={11} />
                  )}
                  {m.kind === 'image' ? 'Image' : formatClock(m.duration)}
                  <span aria-hidden>·</span>
                  <span className={cn(uses > 0 && 'text-brand-bright')}>
                    {uses === 0 ? 'unused' : `used ${uses}×`}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addClipFromMedia(m.id);
                  // Close the mobile sheet so the clip landing on the timeline /
                  // preview is visible (no-op layout-wise on desktop).
                  setPanelOpen(false);
                }}
                title="Add to a new track"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <Plus size={16} />
              </button>
            </div>
          );
        })}
        {media.length === 0 && <p className="text-sm text-ink-faint">No media yet. Add a video, image or audio to begin.</p>}
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Each item you add lands on its own track. Higher tracks overlay the ones below.
      </p>
    </div>
  );
}
