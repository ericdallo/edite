import { Film, Gauge, LayoutTemplate, type LucideIcon, Sparkles, Type, Volume2, X } from 'lucide-react';
import { useEditorStore, type ToolId } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { activeSubtoolDef, resolveSubtool, subtoolsFor } from './subtools';
import { MediaLibrary } from '@/components/media/MediaLibrary';
import { TextTool } from './TextTool';
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
  layout: { title: 'Layout', desc: 'Frame, placement & motion', icon: LayoutTemplate },
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
    case 'layout':
      if (sub === 'animate') return <AnimationTool />;
      if (sub === 'canvas') return <AspectRatioTool sub="canvas" />;
      if (sub === 'background') return <AspectRatioTool sub="background" />;
      return <TransformTool />;
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
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line lg:hidden" />

        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-brand-bright">
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
            subcategories collapse into a horizontal strip inside the sheet. */}
        {subs.length > 0 && (
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-line px-3 py-2 lg:hidden">
            {subs.map((s) => {
              const SubIcon = s.icon;
              const on = activeSub === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSubtool(s.id)}
                  aria-pressed={on}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    on
                      ? 'border-brand bg-brand/15 text-ink'
                      : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
                  )}
                >
                  <SubIcon size={14} />
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <ToolContent tool={tool} sub={activeSub} />
        </div>
      </aside>
    </>
  );
}
