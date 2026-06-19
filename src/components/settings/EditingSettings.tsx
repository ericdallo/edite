import { Magnet } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { ASPECT_RATIOS, type AspectRatioId } from '@/types/editor';
import { Field, selectClass, ToggleRow } from './controls';

export function EditingSettings() {
  const snap = useEditorStore((s) => s.snap);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const defaultAspect = useEditorStore((s) => s.defaultAspect);
  const setDefaultAspect = useEditorStore((s) => s.setDefaultAspect);

  return (
    <div className="space-y-6">
      <ToggleRow
        icon={<Magnet size={17} />}
        label="Snap to edges"
        desc="Snap clips to neighbouring clips and the playhead while dragging."
        on={snap}
        onToggle={toggleSnap}
      />

      <Field label="Default aspect ratio for new projects">
        <select
          value={defaultAspect}
          onChange={(e) => setDefaultAspect(e.target.value as AspectRatioId)}
          className={selectClass}
          aria-label="Default aspect ratio"
        >
          <option value="original">Original (match source)</option>
          {ASPECT_RATIOS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label} — {a.hint}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
