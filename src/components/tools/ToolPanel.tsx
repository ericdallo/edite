import { Film, Gauge, type LucideIcon, Move, Ratio, Type, Volume2 } from 'lucide-react';
import { useEditorStore, type ToolId } from '@/store/editorStore';
import { MediaLibrary } from '@/components/media/MediaLibrary';
import { TextTool } from './TextTool';
import { TransformTool } from './TransformTool';
import { SpeedTool } from './SpeedTool';
import { AspectRatioTool } from './AspectRatioTool';
import { MuteTool } from './MuteTool';

const META: Record<ToolId, { title: string; desc: string; icon: LucideIcon }> = {
  media: { title: 'Media', desc: 'Your clips and uploads', icon: Film },
  text: { title: 'Text', desc: 'Add and style captions', icon: Type },
  transform: { title: 'Transform', desc: 'Position, size & opacity', icon: Move },
  speed: { title: 'Speed', desc: 'Speed up or slow down', icon: Gauge },
  aspect: { title: 'Aspect ratio', desc: 'Output canvas', icon: Ratio },
  audio: { title: 'Audio', desc: 'Mute or adjust the sound', icon: Volume2 },
};

export function ToolPanel() {
  const tool = useEditorStore((s) => s.selectedTool);
  const meta = META[tool];
  const Icon = meta.icon;

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-line bg-surface/30">
      <div className="flex items-center gap-3 border-b border-line px-4 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-surface-3 text-brand-bright">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">{meta.title}</h2>
          <p className="text-xs text-ink-faint">{meta.desc}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tool === 'media' ? (
          <MediaLibrary />
        ) : tool === 'text' ? (
          <TextTool />
        ) : tool === 'transform' ? (
          <TransformTool />
        ) : tool === 'speed' ? (
          <SpeedTool />
        ) : tool === 'aspect' ? (
          <AspectRatioTool />
        ) : (
          <MuteTool />
        )}
      </div>
    </aside>
  );
}
