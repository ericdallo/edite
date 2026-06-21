import { type ChangeEvent, useRef } from 'react';
import { Aperture, ImagePlus } from 'lucide-react';
import {
  ASPECT_RATIOS,
  BACKGROUND_BLUR,
  BACKGROUND_IMAGE_PREFIX,
  BACKGROUND_SWATCHES,
  backgroundImageId,
  isImageBackground,
  resolveAspectRatio,
} from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { useImportMedia } from '@/hooks/useImportMedia';
import { cn } from '@/lib/utils';

function RatioGlyph({ ratio }: { ratio: number }) {
  const w = ratio >= 1 ? 26 : 26 * ratio;
  const h = ratio >= 1 ? 26 / ratio : 26;
  return (
    <div className="grid h-7 w-7 shrink-0 place-items-center">
      <div className="rounded-[3px] border-2 border-current" style={{ width: w, height: h }} />
    </div>
  );
}

export function AspectRatioTool({ sub = 'canvas' }: { sub?: string }) {
  const aspect = useEditorStore((s) => s.aspect);
  const media = useEditorStore((s) => s.media);
  const background = useEditorStore((s) => s.background);
  const setAspect = useEditorStore((s) => s.setAspect);
  const setBackground = useEditorStore((s) => s.setBackground);
  const { importFiles } = useImportMedia();
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    e.target.value = '';
    if (!files || files.length === 0) return;
    const before = new Set(useEditorStore.getState().media.map((m) => m.id));
    await importFiles(files, { addToTimeline: false });
    const added = useEditorStore.getState().media.find((m) => !before.has(m.id) && m.kind === 'image');
    if (added) setBackground(`${BACKGROUND_IMAGE_PREFIX}${added.id}`);
  };

  if (sub === 'background') {
    const isBlur = background === BACKGROUND_BLUR;
    const isImg = isImageBackground(background);
    const bgImageId = backgroundImageId(background);
    const imageMedia = media.filter((m) => m.kind === 'image');
    return (
      <div className="space-y-4">
        <div className="text-xs font-medium text-ink-muted">Background</div>
        <button
          onClick={() => setBackground(BACKGROUND_BLUR)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
            isBlur ? 'border-brand bg-brand/10' : 'border-line bg-surface-2 hover:bg-surface-3',
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand/50 to-accent/40">
            <Aperture size={16} className="text-white" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink">Blurred video</div>
            <div className="truncate text-[11px] text-ink-faint">Fill the bars with a soft blur of your clip</div>
          </div>
        </button>
        <div className="pt-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Image</div>
        <div className="flex flex-wrap items-center gap-2">
          {imageMedia.map((m) => (
            <button
              key={m.id}
              onClick={() => setBackground(`${BACKGROUND_IMAGE_PREFIX}${m.id}`)}
              aria-label={`Background image ${m.fileName}`}
              className={cn(
                'h-12 w-12 overflow-hidden rounded-lg border transition-transform hover:scale-105',
                isImg && bgImageId === m.id ? 'border-brand ring-2 ring-brand' : 'border-line',
              )}
            >
              <img src={m.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            title="Import an image"
            aria-label="Import a background image"
            className="grid h-12 w-12 place-items-center rounded-lg border border-dashed border-line text-ink-faint transition-colors hover:border-ink-faint hover:text-ink"
          >
            <ImagePlus size={16} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImageFile} />
        </div>
        <div className="pt-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Solid color</div>
        <div className="flex flex-wrap items-center gap-2">
          {BACKGROUND_SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setBackground(c)}
              aria-label={`Background ${c}`}
              className={cn(
                'h-7 w-7 rounded-full border transition-transform hover:scale-110',
                !isBlur && background.toLowerCase() === c ? 'border-white ring-2 ring-brand' : 'border-black/40',
              )}
              style={{ background: c }}
            />
          ))}
          <label className="relative h-7 w-7 overflow-hidden rounded-full border border-line" title="Custom color">
            <span
              className="block h-full w-full"
              style={{ background: 'conic-gradient(from 180deg, #f43f5e, #fbbf24, #34d399, #22d3ee, #8b5cf6, #f43f5e)' }}
            />
            <input
              type="color"
              value={isBlur || isImg ? '#000000' : background}
              onChange={(e) => setBackground(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Custom background color"
            />
          </label>
        </div>
        <p className="text-xs leading-relaxed text-ink-faint">
          Fills the canvas behind clips that don&rsquo;t cover the whole frame.
        </p>
      </div>
    );
  }

  // Default: 'canvas' — output aspect ratio.
  const originalRatio = resolveAspectRatio('original', media);
  const isOriginal = aspect === 'original';

  return (
    <div className="space-y-4">
      <button
        onClick={() => setAspect('original')}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
          isOriginal ? 'border-brand bg-brand/10 text-brand-bright' : 'border-line bg-surface-2 text-ink-faint hover:bg-surface-3',
        )}
      >
        <RatioGlyph ratio={originalRatio} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">Original</div>
          <div className="truncate text-[11px] text-ink-faint">Match the source — no cropping</div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-2">
        {ASPECT_RATIOS.map((a) => {
          const selected = aspect === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setAspect(a.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
                selected ? 'border-brand bg-brand/10 text-brand-bright' : 'border-line bg-surface-2 text-ink-faint hover:bg-surface-3',
              )}
            >
              <RatioGlyph ratio={a.ratio} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{a.label}</div>
                <div className="truncate text-[11px] text-ink-faint">{a.hint}</div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-ink-faint">
        Sets the output canvas. <span className="text-ink-muted">Original</span> keeps your video&rsquo;s
        shape; the presets crop clips to fit. Use Transform to reposition a clip within the frame.
      </p>
    </div>
  );
}
