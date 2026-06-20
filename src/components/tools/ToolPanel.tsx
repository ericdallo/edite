import { type PointerEvent as ReactPointerEvent, useRef } from 'react';
import { Diamond, Film, Gauge, LayoutTemplate, type LucideIcon, Shapes, Sparkles, Type, Volume2, X } from 'lucide-react';
import { useEditorStore, type ToolId } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { activeSubtoolDef, resolveSubtool, subtoolsFor } from './subtools';
import { MediaLibrary } from '@/components/media/MediaLibrary';
import { TextTool } from './TextTool';
import { ShapeTool } from './ShapeTool';
import { CaptionsTool } from './CaptionsTool';
import { TransformTool } from './TransformTool';
import { AnimationTool } from './AnimationTool';
import { SpeedTool } from './SpeedTool';
import { EffectsTool } from './EffectsTool';
import { AspectRatioTool } from './AspectRatioTool';
import { AudioTool } from './AudioTool';

/** Category header fallback (icon always shown; title/desc used when the tool has no subcategories). */
const META: Record<ToolId, { title: string; desc: string; icon: LucideIcon }> = {
  media: { title: 'Media', desc: 'Your clips and uploads', icon: Film },
  text: { title: 'Text', desc: 'Text overlays & captions', icon: Type },
  shape: { title: 'Shapes', desc: 'Vector shapes & stickers', icon: Shapes },
  layout: { title: 'Layout', desc: 'Frame & placement', icon: LayoutTemplate },
  animate: { title: 'Animate', desc: 'Keyframe motion & text in/out', icon: Diamond },
  speed: { title: 'Speed', desc: 'Speed up or slow down', icon: Gauge },
  effects: { title: 'Effects', desc: 'Filters, transitions & keying', icon: Sparkles },
  audio: { title: 'Audio', desc: 'Volume, fades & mute', icon: Volume2 },
};

function ToolContent({ tool, sub }: { tool: ToolId; sub: string }) {
  switch (tool) {
    case 'media':
      return <MediaLibrary />;
    case 'text':
      return sub === 'captions' ? <CaptionsTool /> : <TextTool />;
    case 'shape':
      return <ShapeTool />;
    case 'layout':
      if (sub === 'canvas') return <AspectRatioTool sub="canvas" />;
      if (sub === 'background') return <AspectRatioTool sub="background" />;
      return <TransformTool />;
    case 'animate':
      return <AnimationTool />;
    case 'speed':
      return <SpeedTool sub={sub} />;
    case 'effects':
      return <EffectsTool sub={sub} />;
    case 'audio':
      return <AudioTool sub={sub} />;
  }
}

export function ToolPanel() {
  const tool = useEditorStore((s) => s.selectedTool);
  const selectedSubtool = useEditorStore((s) => s.selectedSubtool);
  const setSubtool = useEditorStore((s) => s.setSelectedSubtool);
  const panelOpen = useEditorStore((s) => s.panelOpen);
  const setPanelOpen = useEditorStore((s) => s.setPanelOpen);
  const collapsed = useEditorStore((s) => s.sidebarCollapsed);
  const asideRef = useRef<HTMLElement>(null);

  // Drag the sheet handle down to dismiss it (mobile only): the sheet follows
  // the finger, then closes past a threshold or snaps back, restoring the
  // class-driven transition afterwards. The desktop panel is a static column.
  const dragSheet = (e: ReactPointerEvent) => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) return;
    const aside = asideRef.current;
    if (!aside) return;
    const startY = e.clientY;
    let dy = 0;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore a pointer that's already gone
    }
    aside.style.transition = 'none';
    const move = (ev: PointerEvent) => {
      dy = Math.max(0, ev.clientY - startY);
      aside.style.transform = dy ? `translateY(${dy}px)` : '';
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      aside.style.transition = '';
      if (dy > 90) {
        // Far enough: finish the close, then hand the inline styles back to the
        // classes so the sheet can reopen normally.
        aside.style.transform = 'translateY(100%)';
        setPanelOpen(false);
        window.setTimeout(() => {
          aside.style.transform = '';
          aside.style.transition = '';
        }, 220);
      } else {
        aside.style.transform = ''; // snap back open
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const meta = META[tool];
  const Icon = meta.icon;
  const subs = subtoolsFor(tool);
  const activeSub = resolveSubtool(tool, selectedSubtool);
  const subDef = activeSubtoolDef(tool, selectedSubtool);
  // Header reflects the active subcategory when there is one, else the category.
  const title = subDef?.label ?? meta.title;
  const desc = subDef?.desc ?? meta.desc;
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
        ref={asideRef}
        className={cn(
          'order-3 flex flex-col bg-surface shadow-2xl',
          // mobile: bottom sheet
          'fixed inset-x-0 bottom-0 z-40 max-h-[80dvh] rounded-t-2xl border border-line transition-[transform,width,opacity] duration-200 ease-out',
          panelOpen ? 'translate-y-0' : 'translate-y-full',
          // Fixed slice when the preview is docked above (height matches the
          // spacer in EditorLayout); content scrolls within.
          previewAbove && 'h-[52dvh] lg:h-auto',
          // desktop: static left column (after the icon rail + subtool rail)
          'lg:static lg:bottom-auto lg:z-auto lg:order-3 lg:max-h-none lg:w-[300px] lg:translate-y-0 lg:overflow-hidden lg:rounded-none lg:border-0 lg:border-r lg:border-line lg:bg-surface/30 lg:shadow-none',
          // desktop: collapse alongside the rail when hidden (mobile sheet unaffected)
          collapsed && 'lg:w-0 lg:min-w-0 lg:border-r-0 lg:opacity-0 lg:pointer-events-none',
        )}
      >
        {/* Grab strip: drag it down to dismiss the sheet (comfortable touch target). */}
        <div
          onPointerDown={dragSheet}
          aria-hidden
          className="flex shrink-0 touch-none cursor-grab justify-center pb-1 pt-2.5 active:cursor-grabbing lg:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>

        <div
          className={cn(
            // On mobile with sub-tabs the tab bar's border is the separator, so
            // the header keeps its border only when there are no tabs below it.
            'flex items-center gap-3 px-4 py-3.5 lg:border-b lg:border-line',
            subs.length === 0 && 'border-b border-line',
          )}
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand-bright">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <p className="truncate text-xs text-ink-faint">{desc}</p>
          </div>
          <button
            onClick={() => setPanelOpen(false)}
            aria-label="Close panel"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mobile sub-tabs: the desktop subtool rail is hidden here, so the
            subcategories collapse into an underlined tab bar inside the sheet. */}
        {subs.length > 0 && (
          <div role="tablist" className="flex shrink-0 border-b border-line px-2 lg:hidden">
            {subs.map((s) => {
              const on = activeSub === s.id;
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSubtool(s.id)}
                  className={cn(
                    'relative flex-1 whitespace-nowrap px-1 py-3 text-center text-[13px] font-medium transition-colors',
                    on ? 'text-brand-bright' : 'text-ink-faint hover:text-ink-muted',
                  )}
                >
                  {s.label}
                  {on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-4">
          <ToolContent tool={tool} sub={activeSub} />
        </div>
      </aside>
    </>
  );
}
