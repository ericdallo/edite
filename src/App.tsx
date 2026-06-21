import { useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { usePersistence } from '@/hooks/usePersistence';
import { useProjects } from '@/hooks/useProjects';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useHistory } from '@/hooks/useHistory';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { useTheme } from '@/hooks/useTheme';
import { Topbar } from '@/components/layout/Topbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { SubtoolRail } from '@/components/layout/SubtoolRail';
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
  useNavigationGuard();
  useTheme();
  const projects = useProjects();
  const view = useEditorStore((s) => s.view);
  const hasContent = useEditorStore((s) => s.media.length > 0 || s.clips.length > 0);
  const [exportOpen, setExportOpen] = useState(false);

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
        // Empty project: no editor chrome at all — just the hero. The rail,
        // tools and timeline only appear once there's media to work on.
        rail={hasContent ? <Sidebar /> : null}
        subrail={hasContent ? <SubtoolRail /> : null}
        panel={hasContent ? <ToolPanel /> : null}
        stage={hasContent ? <VideoPreview /> : <Dropzone />}
        timeline={hasContent ? <Timeline /> : null}
      />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
