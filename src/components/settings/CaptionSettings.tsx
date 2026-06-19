import { useEditorStore } from '@/store/editorStore';
import { CAPTION_LANGUAGES, CAPTION_MODELS, type CaptionModelId } from '@/lib/captions/models';
import { CAPTION_LENGTH_OPTIONS, type CaptionLength } from '@/lib/captions/segments';
import { Field, selectClass } from './controls';

function gpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { gpu?: unknown }).gpu != null;
}

export function CaptionSettings() {
  const captionDefaults = useEditorStore((s) => s.captionDefaults);
  const setCaptionDefaults = useEditorStore((s) => s.setCaptionDefaults);
  const hasGpu = gpuAvailable();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Default model">
          <select
            value={captionDefaults.model}
            onChange={(e) => setCaptionDefaults({ model: e.target.value as CaptionModelId })}
            className={selectClass}
            aria-label="Default caption model"
          >
            {CAPTION_MODELS.map((m) => (
              <option key={m.id} value={m.id} disabled={m.gpuOnly && !hasGpu}>
                {m.label}
                {m.gpuOnly && !hasGpu ? ' (needs GPU)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Default language">
          <select
            value={captionDefaults.language}
            onChange={(e) => setCaptionDefaults({ language: e.target.value })}
            className={selectClass}
            aria-label="Default caption language"
          >
            {CAPTION_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Default length">
        <select
          value={captionDefaults.length}
          onChange={(e) => setCaptionDefaults({ length: e.target.value as CaptionLength })}
          className={selectClass}
          aria-label="Default caption length"
        >
          {CAPTION_LENGTH_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <p className="text-xs leading-relaxed text-ink-faint">
        The starting point in the Auto-captions tool. Transcription always runs on your device.
      </p>
    </div>
  );
}
