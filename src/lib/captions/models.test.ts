import { describe, expect, it } from 'vitest';
import { isEnglishOnly, whisperRepo } from '@/lib/captions/models';

describe('whisperRepo', () => {
  it('uses the multilingual model by default', () => {
    expect(whisperRepo('base', false)).toBe('onnx-community/whisper-base');
    expect(whisperRepo('tiny', false)).toBe('onnx-community/whisper-tiny');
  });

  it('uses the smaller .en variant for English-only', () => {
    expect(whisperRepo('base', true)).toBe('onnx-community/whisper-base.en');
    expect(whisperRepo('tiny', true)).toBe('onnx-community/whisper-tiny.en');
  });
});

describe('isEnglishOnly', () => {
  it('is true only for the english code', () => {
    expect(isEnglishOnly('en')).toBe(true);
    expect(isEnglishOnly('auto')).toBe(false);
    expect(isEnglishOnly('pt')).toBe(false);
  });
});
