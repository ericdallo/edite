import { ZoomIn, ZoomOut } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { Slider } from '@/components/ui/Slider';

export function ZoomControls() {
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setZoom(zoom / 1.4)}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label="Zoom out"
      >
        <ZoomOut size={16} />
      </button>
      <Slider
        className="hidden w-24 sm:block"
        min={0.5}
        max={6}
        step={0.1}
        value={zoom}
        onChange={setZoom}
        ariaLabel="Timeline zoom"
      />
      <button
        onClick={() => setZoom(zoom * 1.4)}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        aria-label="Zoom in"
      >
        <ZoomIn size={16} />
      </button>
    </div>
  );
}
