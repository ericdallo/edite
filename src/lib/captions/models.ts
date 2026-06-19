/**
 * Whisper model + language registry for on-device auto-captions. Everything
 * runs locally via Transformers.js; the only network touch is a one-time model
 * download from the Hugging Face CDN (cached by the browser afterwards).
 */

export type CaptionModelId = 'tiny' | 'base';

export interface CaptionModelOption {
  id: CaptionModelId;
  label: string;
  hint: string;
  /** Rough download size for the quantized model, shown in the UI. */
  size: string;
}

/** Models offered in the tool. `base` is the accuracy/size sweet spot; `tiny` is faster. */
export const CAPTION_MODELS: CaptionModelOption[] = [
  { id: 'base', label: 'Base', hint: 'Best accuracy', size: '~80 MB' },
  { id: 'tiny', label: 'Tiny', hint: 'Fastest', size: '~40 MB' },
];

export interface CaptionLanguage {
  /** ISO code, or 'auto' to let Whisper detect it. */
  code: string;
  label: string;
}

/**
 * Auto-detect plus a curated set of common languages. 'auto' and any non-'en'
 * code use the multilingual model; 'en' uses the smaller, sharper English-only
 * variant (see {@link whisperRepo}).
 */
export const CAPTION_LANGUAGES: CaptionLanguage[] = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
];

/**
 * Hugging Face repo for a model. English-only picks the smaller, more accurate
 * `.en` variant; everything else uses the multilingual model. The
 * `onnx-community` namespace ships the Transformers.js v3 ONNX weights.
 */
export function whisperRepo(model: CaptionModelId, englishOnly: boolean): string {
  return `onnx-community/whisper-${model}${englishOnly ? '.en' : ''}`;
}

/** Whether a chosen language should use the English-only model. */
export function isEnglishOnly(language: string): boolean {
  return language === 'en';
}

/**
 * The Whisper language name to pass to the transcriber, or null when none is
 * needed: 'auto' lets the model detect it, and 'en' runs the English-only model
 * (which rejects an explicit language). Other codes resolve to their lowercase
 * English name (e.g. 'pt' -> 'portuguese'), which Whisper accepts.
 */
export function whisperLanguageName(language: string): string | null {
  if (language === 'auto' || language === 'en') return null;
  const found = CAPTION_LANGUAGES.find((l) => l.code === language);
  return found ? found.label.toLowerCase() : null;
}
