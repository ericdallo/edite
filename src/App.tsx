import { useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { usePersistence } from '@/hooks/usePersistence';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useHistory } from '@/hooks/useHistory';
import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { EditorLayout } from '@/components/layout/EditorLayout';
import { Dropzone } from '@/components/upload/Dropzone';
import { VideoPreview } from '@/components/preview/VideoPreview';
import { Timeline } from '@/components/timeline/Timeline';
import { ToolPanel } from '@/components/tools/ToolPanel';
import { ExportDialog } from '@/components/export/ExportDialog';

export default function App() {
  usePersistence();
  useHistory();
  useKeyboardShortcuts();
  const hasContent = useEditorStore((s) => s.media.length > 0 || s.clips.length > 0);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const [exportOpen, setExportOpen] = useState(false);
  // Show the panel for the Text tool even on an empty project, so the first
  // text overlay can be added without any media.
  const showPanel = hasContent || selectedTool === 'text';

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Topbar onExport={() => setExportOpen(true)} />
      <EditorLayout
        rail={<Sidebar />}
        panel={showPanel ? <ToolPanel /> : null}
        stage={hasContent ? <VideoPreview /> : <Dropzone />}
        timeline={
          hasContent ? (
            <Timeline />
          ) : (
            <div className="h-[120px] shrink-0 border-t border-line bg-surface/40">
              <Dropzone compact />
            </div>
          )
        }
      />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
