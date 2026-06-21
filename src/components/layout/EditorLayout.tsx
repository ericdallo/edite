import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { readPref, writePref } from '@/lib/prefs';
import { clamp, cn } from '@/lib/utils';
import { SidebarToggle } from './SidebarToggle';

const TL_HEIGHT_KEY = 'edite:timelineHeight';

export interface EditorLayoutProps {
  rail: ReactNode;
  /** desktop-only second rail with the selected tool's subcategories. */
  subrail: ReactNode;
  panel: ReactNode;
  stage: ReactNode;
  /** The tracks area. Pass null (empty state) to let the stage fill the column. */
  timeline: ReactNode;
}

export function EditorLayout({ rail, subrail, panel, stage, timeline }: EditorLayoutProps) {
  const panelOpen = useEditorStore((s) => s.panelOpen);
  const tool = useEditorStore((s) => s.selectedTool);
  // On mobile the tool settings slide up as a bottom sheet. For canvas-affecting
  // tools we dock the preview into the space above the sheet so edits (layout,
  // effects, opacity…) stay visible while you drag a slider. The media browser
  // keeps the tall sheet — it has nothing to preview. Desktop is untouched.
  const previewAbove = panel != null && panelOpen && tool !== 'media';

  // Desktop-only: a saved timeline height (px) feeds the --tl-h var the lg height
  // below reads, so users can trade space between the preview and the tracks.
  // Mobile keeps its fixed height (the var is only consumed at lg).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [timelineH, setTimelineH] = useState<number | null>(() => readPref<number | null>(TL_HEIGHT_KEY, null));

  const startResize = (e: ReactPointerEvent) => {
    if (window.innerWidth < 1024) return; // a desktop affordance
    e.preventDefault();
    const wrap = wrapRef.current;
    const col = wrap?.parentElement;
    if (!wrap || !col) return;
    const startY = e.clientY;
    const startH = wrap.getBoundingClientRect().height;
    const maxH = Math.max(180, col.getBoundingClientRect().height - 200); // keep room for the preview
    let next = startH;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture can throw if the pointer is already gone; ignore.
    }
    const move = (ev: PointerEvent) => {
      next = clamp(startH - (ev.clientY - startY), 160, maxH);
      setTimelineH(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      writePref(TL_HEIGHT_KEY, Math.round(next));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const tlStyle = timelineH != null ? ({ '--tl-h': `${timelineH}px` } as CSSProperties) : undefined;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="relative order-1 flex min-w-0 flex-1 flex-col lg:order-4">
        {/* The collapse handle only makes sense when there's a rail to collapse. */}
        {rail && <SidebarToggle />}
        <div className="relative min-h-0 flex-1">{stage}</div>
        {/* Empty state passes no timeline: the stage then fills the whole column
            (no reserved strip), so the hero isn't crowded on either platform. */}
        {timeline && (
          <div
            ref={wrapRef}
            style={tlStyle}
            className={cn(
              'relative h-[220px] shrink-0 lg:h-[var(--tl-h,260px)] lg:max-h-[80dvh]',
              previewAbove ? 'hidden lg:block' : 'block',
            )}
          >
            {/* Drag the seam to trade space between the preview and the tracks. */}
            <div
              onPointerDown={startResize}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize timeline"
              title="Drag to resize"
              className="group absolute inset-x-0 top-0 z-20 hidden h-2 -translate-y-1/2 cursor-row-resize touch-none lg:block"
            >
              <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-transparent transition-colors group-hover:bg-brand/50" />
            </div>
            {timeline}
          </div>
        )}
        {/* Reserves the lower viewport for the sheet so the preview shrinks to
            sit above it. Height must match the sheet's in ToolPanel. */}
        <div aria-hidden className={cn('shrink-0 lg:hidden', previewAbove ? 'h-[52dvh]' : 'hidden')} />
      </div>
      <div className={cn(previewAbove ? 'hidden lg:contents' : 'contents')}>{rail}</div>
      {/* Desktop second rail (subcategories); renders nothing when the tool has none. */}
      {subrail}
      {panel}
    </div>
  );
}
