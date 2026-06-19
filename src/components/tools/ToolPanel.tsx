import {
  Captions,
  Film,
  Gauge,
  type LucideIcon,
  Move,
  Ratio,
  Sparkles,
  Spline,
  Type,
  Volume2,
  X,
} from 'lucide-react';
import { useEditorStore, type ToolId } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { MediaLibrary } from '@/components/media/MediaLibrary';
import { TextTool } from './TextTool';
import { CaptionsTool } from './CaptionsTool';
import { TransformTool } from './TransformTool';
import { AnimationTool } from './AnimationTool';
import { SpeedTool } from './SpeedTool';
import { EffectsTool } from './EffectsTool';
import { AspectRatioTool } from './AspectRatioTool';
import { AudioTool } from './AudioTool';

const META: Record<ToolId, { title: string; desc: string; icon: LucideIcon }> = {
  media: { title: 'Media', desc: 'Your clips and uploads', icon: Film },
  text: { title: 'Text', desc: 'Add and style captions', icon: Type },
  captions: { title: 'Auto-captions', desc: 'Transcribe speech on-device', icon: Captions },
  transform: { title: 'Transform', desc: 'Position, size & opacity', icon: Move },
  animation: { title: 'Animation', desc: 'Keyframe motion over time', icon: Spline },
  speed: { title: 'Speed', desc: 'Speed up or slow down', icon: Gauge },
  effects: { title: 'Effects', desc: 'Color filters & looks', icon: Sparkles },
  aspect: { title: 'Aspect ratio', desc: 'Output canvas', icon: Ratio },
  audio: { title: 'Audio', desc: 'Volume, fades & mute', icon: Volume2 },
};

export function ToolPanel() {
  const tool = useEditorStore((s) => s.selectedTool);
  const panelOpen = useEditorStore((s) => s.panelOpen);
  const setPanelOpen = useEditorStore((s) => s.setPanelOpen);
  const collapsed = useEditorStore((s) => s.sidebarCollapsed);
  const meta = META[tool];
  const Icon = meta.icon;
  // Mobile only: a canvas-affecting tool docks the preview above the sheet (see
  // EditorLayout), so the sheet takes a fixed slice and the backdrop must not
  // dim or block the live preview behind it.
  const previewAbove = panelOpen && tool !== 'media';

  return (
    <>
      {/* Mobile backdrop for the bottom sheet. */}
      <div
        onClick={() => setPanelOpen(false)}
        aria-hidden
        className={cn(
          'fixed inset-0 z-30 transition-opacity lg:hidden',
          panelOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          previewAbove
            ? 'pointer-events-none bg-transparent backdrop-blur-none'
            : 'bg-black/50 backdrop-blur-sm',
        )}
      />

      <aside
        className={cn(
          'order-3 flex flex-col bg-surface shadow-2xl',
          // mobile: bottom sheet
          'fixed inset-x-0 bottom-0 z-40 max-h-[80dvh] rounded-t-2xl border border-line transition-[transform,width,opacity] duration-200 ease-out',
          panelOpen ? 'translate-y-0' : 'translate-y-full',
          // Fixed slice when the preview is docked above (height matches the
          // spacer in EditorLayout); content scrolls within.
          previewAbove && 'h-[52dvh] lg:h-auto',
          // desktop: static left column
          'lg:static lg:bottom-auto lg:z-auto lg:order-2 lg:max-h-none lg:w-[300px] lg:translate-y-0 lg:overflow-hidden lg:rounded-none lg:border-0 lg:border-r lg:border-line lg:bg-surface/30 lg:shadow-none',
          // desktop: collapse alongside the rail when hidden (mobile sheet unaffected)
          collapsed && 'lg:w-0 lg:min-w-0 lg:border-r-0 lg:opacity-0 lg:pointer-events-none',
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line lg:hidden" />

        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-brand-bright">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">{meta.title}</h2>
            <p className="truncate text-xs text-ink-faint">{meta.desc}</p>
          </div>
          <button
            onClick={() => setPanelOpen(false)}
            aria-label="Close panel"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tool === 'media' ? (
            <MediaLibrary />
          ) : tool === 'text' ? (
            <TextTool />
          ) : tool === 'captions' ? (
            <CaptionsTool />
          ) : tool === 'transform' ? (
            <TransformTool />
          ) : tool === 'animation' ? (
            <AnimationTool />
          ) : tool === 'speed' ? (
            <SpeedTool />
          ) : tool === 'effects' ? (
            <EffectsTool />
          ) : tool === 'aspect' ? (
            <AspectRatioTool />
          ) : (
            <AudioTool />
          )}
        </div>
      </aside>
    </>
  );
}
