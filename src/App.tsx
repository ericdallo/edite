import { useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { usePersistence } from '@/hooks/usePersistence';
import { useProjects } from '@/hooks/useProjects';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useHistory } from '@/hooks/useHistory';
import { useTheme } from '@/hooks/useTheme';
import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { EditorLayout } from '@/components/layout/EditorLayout';
import { Dropzone } from '@/components/upload/Dropzone';
import { VideoPreview } from '@/components/preview/VideoPreview';
import { Timeline } from '@/components/timeline/Timeline';
import { ToolPanel } from '@/components/tools/ToolPanel';
import { ExportDialog } from '@/components/export/ExportDialog';
import { ProjectsPage } from '@/components/projects/ProjectsPage';

export default function App() {
  usePersistence();
  useHistory();
  useKeyboardShortcuts();
  useTheme();
  const projects = useProjects();
  const view = useEditorStore((s) => s.view);
  const hasContent = useEditorStore((s) => s.media.length > 0 || s.clips.length > 0);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const [exportOpen, setExportOpen] = useState(false);
  // Show the panel for the Text tool even on an empty project, so the first
  // text overlay can be added without any media.
  const showPanel = hasContent || selectedTool === 'text';

  if (view === 'projects') {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        <ProjectsPage projects={projects} />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Topbar projects={projects} onExport={() => setExportOpen(true)} />
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
