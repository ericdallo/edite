import { Film, Gauge, type LucideIcon, Move, Ratio, Type, Volume2 } from 'lucide-react';
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
  { id: 'transform', label: 'Layout', icon: Move },
  { id: 'speed', label: 'Speed', icon: Gauge },
  { id: 'aspect', label: 'Ratio', icon: Ratio },
  { id: 'audio', label: 'Audio', icon: Volume2 },
];

export function Sidebar() {
  const selected = useEditorStore((s) => s.selectedTool);
  const setTool = useEditorStore((s) => s.setSelectedTool);

  return (
    <nav className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface/40 py-3">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = selected === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className={cn(
              'group relative flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl transition-all',
              active ? 'bg-surface-3 text-ink' : 'text-ink-faint hover:bg-surface-2 hover:text-ink-muted',
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-brand" />
            )}
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
