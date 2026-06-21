import { type DragEvent, useRef, useState } from 'react';
import { AlertCircle, Clapperboard, Gift, Loader2, ShieldCheck, Sparkles, UploadCloud, WifiOff } from 'lucide-react';
import { useImportMedia } from '@/hooks/useImportMedia';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

/** Value props shown under the drop target on the empty-state hero. */
const FEATURES = [
  { icon: Gift, title: 'Free forever', sub: 'No account · no watermark' },
  { icon: Sparkles, title: 'Genuinely powerful', sub: 'Tracks, effects & captions' },
  { icon: WifiOff, title: 'Works offline', sub: 'Installable · no server' },
] as const;

const FORMATS = ['MP4', 'WEBM', 'MOV', 'PNG', 'JPG', 'GIF', 'MP3', 'WAV'] as const;

/** Camera-style focus brackets framing the drop target (one per corner). */
const CORNERS = [
  'left-0 top-0 rounded-tl-xl border-l-2 border-t-2',
  'right-0 top-0 rounded-tr-xl border-r-2 border-t-2',
  'left-0 bottom-0 rounded-bl-xl border-l-2 border-b-2',
  'right-0 bottom-0 rounded-br-xl border-r-2 border-b-2',
] as const;

/**
 * Empty-state hero, styled as an editor viewfinder rather than the usual
 * gradient-blob landing. The whole stage is the drop surface (drop anywhere)
 * over a faint measurement grid + film grain; the centred card is the primary
 * call to action, framed by camera focus brackets and a timecode HUD. Content
 * scrolls instead of clipping on short viewports, and there's no separate
 * timeline/footer dropzone — the tracks area only appears once there's media.
 */
export function Dropzone() {
  const { importFiles, busy, error } = useImportMedia();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = () => inputRef.current?.click();

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void importFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Ignore moves between children; only clear when the cursor truly leaves.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragging(false);
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className="relative h-full w-full overflow-y-auto bg-canvas"
    >
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

      {/* "Editor canvas" backdrop: a faint measurement grid, a cinematic
          vignette and a touch of film grain — deliberately no gradient blobs. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: 'radial-gradient(var(--color-line) 1px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 75% 60% at 50% 42%, transparent 38%, color-mix(in srgb, var(--color-canvas) 70%, #000) 100%)',
          }}
        />
        <svg className="absolute inset-0 h-full w-full opacity-[0.06] mix-blend-soft-light">
          <filter id="edite-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#edite-grain)" />
        </svg>
      </div>

      {/* Soft full-stage drop hint (you can drop anywhere on the stage). */}
      {dragging && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-brand/5 ring-1 ring-inset ring-brand/40" />
      )}

      {/* Centre when there's room, scroll when there isn't (no clipping). */}
      <div className="relative flex min-h-full flex-col">
        <div className="m-auto flex w-full max-w-xl flex-col items-center px-5 py-12 sm:py-16">
          <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-line/70 bg-surface-2/60 px-3.5 py-1.5 font-mono text-[11px] tracking-wide text-ink-muted backdrop-blur-sm">
            <ShieldCheck size={13} className="text-brand-bright" />
            100% private — nothing is uploaded
          </span>

          {/* Viewfinder frame: focus brackets + a timecode HUD around the card. */}
          <div className="relative w-full p-2.5 sm:p-3">
            {CORNERS.map((pos) => (
              <span
                key={pos}
                aria-hidden
                className={cn(
                  'pointer-events-none absolute h-6 w-6 transition-colors duration-200 sm:h-7 sm:w-7',
                  pos,
                  dragging ? 'border-brand' : 'border-ink-faint/40',
                )}
              />
            ))}

            {/* Camera HUD: rec dot + running timecode, sat on the bottom edge. */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2 items-center gap-1.5 rounded-full border border-line/70 bg-canvas px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-ink-faint"
            >
              <span className={cn('h-1.5 w-1.5 rounded-full transition-colors', dragging ? 'bg-danger' : 'bg-ink-faint/60')} />
              00:00:00:00
            </div>

            {/* Drop target + primary CTA. Clickable for convenience; the button
                inside is the real keyboard-accessible control. */}
            <div
              onClick={pick}
              className={cn(
                'group flex w-full cursor-pointer flex-col items-center rounded-2xl border px-6 py-10 text-center shadow-xl shadow-black/20 backdrop-blur-sm transition-all duration-200 sm:px-12 sm:py-12',
                dragging
                  ? 'border-brand/60 bg-brand/10'
                  : 'border-line/60 bg-surface/55 hover:border-brand/40 hover:bg-surface/70',
              )}
            >
              <div className="mb-6 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-[1.25rem] bg-gradient-to-br from-brand to-accent shadow-2xl shadow-brand/40 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
                {busy ? (
                  <Loader2 className="animate-spin text-white" size={34} />
                ) : (
                  <Clapperboard className="text-white" size={34} />
                )}
              </div>

              <h1 className="text-[1.7rem] font-bold tracking-tight text-ink sm:text-[2rem]">
                {busy ? 'Reading your files…' : dragging ? 'Drop to import' : 'Make something great'}
              </h1>
              <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-ink-muted">
                {busy
                  ? 'Hang tight — this all happens on your device.'
                  : 'Drop a video, image or audio clip to start, or choose one from your device. Tracks, effects, captions and 4K export — all in your browser.'}
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
                  <span className="mt-3 text-xs text-ink-faint">or drag &amp; drop anywhere</span>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Value props: stacked on phones, a three-up row from sm. */}
          <div className="mt-9 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-3 rounded-2xl border border-line/60 bg-surface-2/40 p-3.5 text-left sm:flex-col sm:items-center sm:gap-2 sm:p-4 sm:text-center"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand-bright">
                  <f.icon size={18} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink">{f.title}</div>
                  <div className="text-xs leading-snug text-ink-faint">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Supported formats. */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-1.5">
            {FORMATS.map((f) => (
              <span
                key={f}
                className="rounded-md border border-line/60 bg-surface-2/40 px-2 py-1 font-mono text-[10px] tracking-wide text-ink-faint"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
