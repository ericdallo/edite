import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';

/**
 * Desktop-only handle that sits on the middle of the tool sidebar's right
 * border and collapses / expands it. It is anchored to the left edge of the
 * editor stage, so it tracks the seam as the sidebar animates: a pill centred
 * on the border when open, a flush tab when collapsed.
 */
export function SidebarToggle() {
  const collapsed = useEditorStore((s) => s.sidebarCollapsed);
  const toggle = useEditorStore((s) => s.toggleSidebar);

  return (
    <button
      onClick={toggle}
      title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
      aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
      className={cn(
        'absolute left-0 top-1/2 z-30 hidden h-12 w-6 -translate-y-1/2 items-center justify-center',
        'border border-line bg-surface-2 text-ink-muted shadow-md',
        'transition-all duration-200 ease-out hover:bg-surface-3 hover:text-ink lg:flex',
        collapsed ? 'rounded-r-lg border-l-0' : '-translate-x-1/2 rounded-lg',
      )}
    >
      {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
    </button>
  );
}
