/**
 * Whisper model + language registry for on-device auto-captions. Everything
 * runs locally via Transformers.js; the only network touch is a one-time model
 * download from the Hugging Face CDN (cached by the browser afterwards).
 */

export type CaptionModelId = 'tiny' | 'base' | 'small' | 'turbo';

export interface CaptionModelOption {
  id: CaptionModelId;
  label: string;
  hint: string;
  /** Rough download size for the quantized model, shown in the UI. */
  size: string;
  /** Needs WebGPU (too slow on the WASM fallback); the picker disables it otherwise. */
  gpuOnly?: boolean;
}

/**
 * Models offered in the tool, fastest to most accurate. `small` is the sweet
 * spot for non-English (a big jump over `base` for e.g. Portuguese); `turbo`
 * (large-v3-turbo) is the most accurate but a large download and WebGPU-only.
 */
export const CAPTION_MODELS: CaptionModelOption[] = [
  { id: 'tiny', label: 'Tiny', hint: 'Fastest', size: '~40 MB' },
  { id: 'base', label: 'Base', hint: 'Fast', size: '~80 MB' },
  { id: 'small', label: 'Small', hint: 'Most accurate', size: '~240 MB' },
  { id: 'turbo', label: 'Turbo', hint: 'Best, large download', size: '~800 MB', gpuOnly: true },
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
 * `onnx-community` namespace ships the Transformers.js v3 ONNX weights. `turbo`
 * maps to large-v3-turbo, which is multilingual-only (no `.en`).
 */
export function whisperRepo(model: CaptionModelId, englishOnly: boolean): string {
  if (model === 'turbo') return 'onnx-community/whisper-large-v3-turbo';
  return `onnx-community/whisper-${model}${englishOnly ? '.en' : ''}`;
}

/** Quantization variants we load (subset of what Transformers.js accepts). */
export type WhisperDtype = 'q8' | 'q4' | 'q4f16';

/**
 * Quantization to load per device. `turbo` uses 4-bit (with fp16 activations on
 * WebGPU) to keep the download manageable; the smaller models use 8-bit, which
 * is the accuracy/size sweet spot and runs fine on both WebGPU and WASM.
 */
export function dtypeForModel(model: CaptionModelId, device: 'webgpu' | 'wasm'): WhisperDtype {
  if (model === 'turbo') return device === 'webgpu' ? 'q4f16' : 'q4';
  return 'q8';
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
