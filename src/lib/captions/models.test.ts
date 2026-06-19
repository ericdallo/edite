import { describe, expect, it } from 'vitest';
import {
  CAPTION_MODELS,
  dtypeForModel,
  isEnglishOnly,
  whisperLanguageName,
  whisperRepo,
} from '@/lib/captions/models';

describe('whisperRepo', () => {
  it('uses the multilingual repo by default', () => {
    expect(whisperRepo('tiny', false)).toBe('onnx-community/whisper-tiny');
    expect(whisperRepo('base', false)).toBe('onnx-community/whisper-base');
    expect(whisperRepo('small', false)).toBe('onnx-community/whisper-small');
  });

  it('uses the English-only variant when requested', () => {
    expect(whisperRepo('tiny', true)).toBe('onnx-community/whisper-tiny.en');
    expect(whisperRepo('base', true)).toBe('onnx-community/whisper-base.en');
  });

  it('maps turbo to large-v3-turbo and ignores English-only', () => {
    expect(whisperRepo('turbo', false)).toBe('onnx-community/whisper-large-v3-turbo');
    expect(whisperRepo('turbo', true)).toBe('onnx-community/whisper-large-v3-turbo');
  });
});

describe('dtypeForModel', () => {
  it('quantizes the small models to 8-bit on both devices', () => {
    expect(dtypeForModel('tiny', 'wasm')).toBe('q8');
    expect(dtypeForModel('small', 'webgpu')).toBe('q8');
  });

  it('uses 4-bit for turbo, with fp16 activations on WebGPU', () => {
    expect(dtypeForModel('turbo', 'webgpu')).toBe('q4f16');
    expect(dtypeForModel('turbo', 'wasm')).toBe('q4');
  });
});

describe('language helpers', () => {
  it('only treats plain English as English-only', () => {
    expect(isEnglishOnly('en')).toBe(true);
    expect(isEnglishOnly('pt')).toBe(false);
    expect(isEnglishOnly('auto')).toBe(false);
  });

  it('resolves a Whisper language name, or null for auto/English', () => {
    expect(whisperLanguageName('pt')).toBe('portuguese');
    expect(whisperLanguageName('auto')).toBeNull();
    expect(whisperLanguageName('en')).toBeNull();
  });

  it('marks turbo as WebGPU-only in the registry', () => {
    expect(CAPTION_MODELS.find((m) => m.id === 'turbo')?.gpuOnly).toBe(true);
    expect(CAPTION_MODELS.find((m) => m.id === 'small')?.gpuOnly).toBeUndefined();
  });
});
