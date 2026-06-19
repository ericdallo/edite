import {
  Blend,
  Captions,
  Diamond,
  Eraser,
  Gauge,
  type LucideIcon,
  Move,
  Music,
  PaintBucket,
  Palette,
  Ratio,
  SlidersHorizontal,
  Spline,
  Type,
  Volume2,
} from 'lucide-react';
import type { ToolId } from '@/store/editorStore';

/** A subcategory within a tool, shown in the subtool rail (desktop) / sub-tabs (mobile). */
export interface SubtoolDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /** one-line summary shown in the panel header when this subcategory is active. */
  desc: string;
}

/**
 * Subcategories per tool, CapCut-style. Tools missing from this map have a
 * single view and show no subtool rail. The order here is the display order;
 * the first entry is the default when none is selected.
 */
export const SUBTOOLS: Partial<Record<ToolId, SubtoolDef[]>> = {
  text: [
    { id: 'text', label: 'Text', icon: Type, desc: 'Add & style text overlays' },
    { id: 'captions', label: 'Captions', icon: Captions, desc: 'Transcribe, edit & style speech' },
  ],
  layout: [
    { id: 'transform', label: 'Transform', icon: Move, desc: 'Position, size & opacity' },
    { id: 'animate', label: 'Animate', icon: Diamond, desc: 'Keyframe motion over time' },
    { id: 'canvas', label: 'Canvas', icon: Ratio, desc: 'Output aspect ratio' },
    { id: 'background', label: 'Background', icon: PaintBucket, desc: 'Canvas fill behind clips' },
  ],
  speed: [
    { id: 'normal', label: 'Normal', icon: Gauge, desc: 'Constant playback speed' },
    { id: 'curve', label: 'Curve', icon: Spline, desc: 'Ramp speed & freeze frames' },
  ],
  effects: [
    { id: 'filters', label: 'Filters', icon: Palette, desc: 'One-tap colour looks' },
    { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal, desc: 'Brightness, contrast & hue' },
    { id: 'transition', label: 'Transition', icon: Blend, desc: 'Cross-fade from the previous clip' },
    { id: 'background', label: 'Remove BG', icon: Eraser, desc: 'Knock out a solid background' },
  ],
  audio: [
    { id: 'clip', label: 'Clip', icon: Volume2, desc: 'Volume & fades for this clip' },
    { id: 'project', label: 'Project', icon: Music, desc: 'Master mute & preview volume' },
  ],
};

/** Subcategories for a tool, or an empty list when it has none. */
export function subtoolsFor(tool: ToolId): SubtoolDef[] {
  return SUBTOOLS[tool] ?? [];
}

/**
 * Resolve the active subtool id for a tool: the selected one when it belongs to
 * the tool, otherwise the tool's first subcategory (or '' when it has none).
 */
export function resolveSubtool(tool: ToolId, selected: string): string {
  const subs = SUBTOOLS[tool];
  if (!subs || subs.length === 0) return '';
  return subs.some((s) => s.id === selected) ? selected : subs[0].id;
}

/** The active subcategory definition for a tool, if any. */
export function activeSubtoolDef(tool: ToolId, selected: string): SubtoolDef | undefined {
  const subs = SUBTOOLS[tool];
  if (!subs || subs.length === 0) return undefined;
  const id = resolveSubtool(tool, selected);
  return subs.find((s) => s.id === id);
}
