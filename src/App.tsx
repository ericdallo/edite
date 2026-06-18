import { useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { usePersistence } from '@/hooks/usePersistence';
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
  const source = useEditorStore((s) => s.source);
  const closeProject = useEditorStore((s) => s.closeProject);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Topbar onNew={closeProject} onExport={() => setExportOpen(true)} />
      <EditorLayout
        rail={<Sidebar />}
        panel={source ? <ToolPanel /> : null}
        stage={source ? <VideoPreview /> : <Dropzone />}
        timeline={
          source ? (
            <Timeline />
          ) : (
            <div className="h-[212px] shrink-0 border-t border-line bg-surface/40">
              <Dropzone compact />
            </div>
          )
        }
      />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
