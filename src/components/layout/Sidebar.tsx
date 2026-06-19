import { Captions, Film, Gauge, type LucideIcon, Move, Ratio, Sparkles, Spline, Type, Volume2 } from 'lucide-react';
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
  { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'transform', label: 'Layout', icon: Move },
  { id: 'animation', label: 'Animate', icon: Spline },
  { id: 'speed', label: 'Speed', icon: Gauge },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'aspect', label: 'Ratio', icon: Ratio },
  { id: 'audio', label: 'Audio', icon: Volume2 },
];

export function Sidebar() {
  const selected = useEditorStore((s) => s.selectedTool);
  const setTool = useEditorStore((s) => s.setSelectedTool);
  const panelOpen = useEditorStore((s) => s.panelOpen);
  const setPanelOpen = useEditorStore((s) => s.setPanelOpen);
  const collapsed = useEditorStore((s) => s.sidebarCollapsed);

  return (
    <nav
      className={cn(
        // mobile: bottom tab bar
        'order-2 flex w-full shrink-0 flex-row items-stretch justify-around gap-1 border-t border-line bg-surface/85 px-1 py-1 backdrop-blur',
        // desktop: vertical left rail
        'lg:order-1 lg:w-[68px] lg:flex-col lg:items-center lg:justify-start lg:gap-1 lg:overflow-hidden lg:border-r lg:border-t-0 lg:bg-surface/40 lg:px-0 lg:py-3 lg:backdrop-blur-none',
        'lg:transition-[width,opacity] lg:duration-200 lg:ease-out',
        // desktop: collapse to nothing when the user hides the sidebar (mobile bar stays)
        collapsed && 'lg:w-0 lg:min-w-0 lg:border-r-0 lg:opacity-0 lg:pointer-events-none',
      )}
    >
      {TOOLS.map((t) => {
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
              'group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-all',
              'lg:h-14 lg:w-14 lg:flex-none lg:py-0',
              active ? 'bg-surface-3 text-ink' : 'text-ink-faint hover:bg-surface-2 hover:text-ink-muted',
            )}
          >
            {active && (
              <span className="absolute left-1/2 top-0 h-1 w-8 -translate-x-1/2 rounded-b-full bg-brand lg:left-0 lg:top-1/2 lg:h-7 lg:w-1 lg:-translate-x-0 lg:-translate-y-1/2 lg:rounded-b-none lg:rounded-r-full" />
            )}
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
