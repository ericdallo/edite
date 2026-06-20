import { useEffect } from 'react';
import { Diamond, Film, Gauge, LayoutTemplate, type LucideIcon, Shapes, Sparkles, Type, Volume2 } from 'lucide-react';
import { useEditorStore, type ToolId } from '@/store/editorStore';
import { cn } from '@/lib/utils';

interface ToolDef {
  id: ToolId;
  label: string;
  icon: LucideIcon;
}

const TOOLS: ToolDef[] = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'shape', label: 'Shapes', icon: Shapes },
  { id: 'layout', label: 'Layout', icon: LayoutTemplate },
  { id: 'animate', label: 'Animate', icon: Diamond },
  { id: 'speed', label: 'Speed', icon: Gauge },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'audio', label: 'Audio', icon: Volume2 },
];

/** Tools that only act on a selected clip; hidden from the rail until one is. */
const CLIP_TOOLS = new Set<ToolId>(['animate', 'speed', 'effects']);

export function Sidebar() {
  const selected = useEditorStore((s) => s.selectedTool);
  const setTool = useEditorStore((s) => s.setSelectedTool);
  const panelOpen = useEditorStore((s) => s.panelOpen);
  const setPanelOpen = useEditorStore((s) => s.setPanelOpen);
  const collapsed = useEditorStore((s) => s.sidebarCollapsed);
  const activeClipId = useEditorStore((s) => s.activeClipId);

  // Clip tools appear only with a clip selected; if the selected clip goes away
  // while one is active, fall back to Media so the panel never shows it empty.
  useEffect(() => {
    if (!activeClipId && CLIP_TOOLS.has(selected)) setTool('media');
  }, [activeClipId, selected, setTool]);
  const tools = activeClipId ? TOOLS : TOOLS.filter((t) => !CLIP_TOOLS.has(t.id));

  return (
    <nav
      className={cn(
        // mobile: bottom tab bar (pad past the home indicator / gesture bar)
        'order-2 flex w-full shrink-0 flex-row items-stretch justify-around gap-0.5 border-t border-line bg-surface/85 px-1 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] backdrop-blur',
        // desktop: vertical left rail
        'lg:order-1 lg:w-[60px] lg:flex-col lg:items-center lg:justify-start lg:gap-0.5 lg:overflow-hidden lg:border-r lg:border-t-0 lg:bg-surface/40 lg:px-0 lg:py-2 lg:backdrop-blur-none',
        'lg:transition-[width,opacity] lg:duration-200 lg:ease-out',
        // desktop: collapse to nothing when the user hides the sidebar (mobile bar stays)
        collapsed && 'lg:w-0 lg:min-w-0 lg:border-r-0 lg:opacity-0 lg:pointer-events-none',
      )}
    >
      {tools.map((t) => {
        const Icon = t.icon;
        const active = selected === t.id;
        return (
          <button
            key={t.id}
            title={t.label}
            aria-label={t.label}
            onClick={() => {
              if (selected === t.id && panelOpen) setPanelOpen(false);
              else {
                setTool(t.id);
                setPanelOpen(true);
              }
            }}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-md py-1 transition-colors',
              'lg:h-12 lg:w-12 lg:flex-none lg:py-0',
              active ? 'bg-brand/15 text-brand-bright' : 'text-ink-faint hover:bg-surface-2 hover:text-ink-muted',
            )}
          >
            <Icon size={19} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
