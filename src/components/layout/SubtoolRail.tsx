import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { resolveSubtool, subtoolsFor } from '@/components/tools/subtools';

/**
 * Desktop-only second rail that appears to the right of the icon rail when the
 * selected tool has subcategories (CapCut-style). It lists those subcategories
 * as icon + label tiles and drives `selectedSubtool`. On mobile the same
 * choices render as a sub-tab strip inside the tool sheet instead, so this is
 * hidden there. Collapses together with the main sidebar.
 */
export function SubtoolRail() {
  const tool = useEditorStore((s) => s.selectedTool);
  const selected = useEditorStore((s) => s.selectedSubtool);
  const setSubtool = useEditorStore((s) => s.setSelectedSubtool);
  const collapsed = useEditorStore((s) => s.sidebarCollapsed);

  const subs = subtoolsFor(tool);
  if (subs.length === 0) return null;
  const active = resolveSubtool(tool, selected);

  return (
    <nav
      aria-label="Subcategories"
      className={cn(
        'hidden shrink-0 flex-col items-stretch gap-0.5 overflow-hidden border-r border-line bg-surface/20 px-1 py-2',
        'lg:order-2 lg:flex lg:w-[60px]',
        'lg:transition-[width,opacity] lg:duration-200 lg:ease-out',
        collapsed && 'lg:w-0 lg:min-w-0 lg:border-r-0 lg:px-0 lg:opacity-0 lg:pointer-events-none',
      )}
    >
      {subs.map((s) => {
        const Icon = s.icon;
        const on = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => setSubtool(s.id)}
            title={s.label}
            aria-label={s.label}
            aria-pressed={on}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1 rounded-md px-0.5 py-2 transition-colors',
              on ? 'bg-brand/15 text-brand-bright' : 'text-ink-faint hover:bg-surface-2 hover:text-ink-muted',
            )}
          >
            <Icon size={18} strokeWidth={on ? 2.4 : 2} />
            <span className="text-center text-[10px] font-medium leading-tight">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
