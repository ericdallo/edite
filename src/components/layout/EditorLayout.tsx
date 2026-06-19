import { type ReactNode } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { cn } from '@/lib/utils';
import { SidebarToggle } from './SidebarToggle';

export interface EditorLayoutProps {
  rail: ReactNode;
  /** desktop-only second rail with the selected tool's subcategories. */
  subrail: ReactNode;
  panel: ReactNode;
  stage: ReactNode;
  timeline: ReactNode;
}

export function EditorLayout({ rail, subrail, panel, stage, timeline }: EditorLayoutProps) {
  const panelOpen = useEditorStore((s) => s.panelOpen);
  const tool = useEditorStore((s) => s.selectedTool);
  // On mobile the tool settings slide up as a bottom sheet. For canvas-affecting
  // tools we dock the preview into the space above the sheet so edits (layout,
  // effects, opacity…) stay visible while you drag a slider. The media browser
  // keeps the tall sheet — it has nothing to preview. Desktop is untouched.
  const previewAbove = panelOpen && tool !== 'media';

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="relative order-1 flex min-w-0 flex-1 flex-col lg:order-4">
        <SidebarToggle />
        <div className="relative min-h-0 flex-1">{stage}</div>
        <div className={cn(previewAbove ? 'hidden lg:contents' : 'contents')}>{timeline}</div>
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
