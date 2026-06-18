import { describe, expect, it } from 'vitest';
import { fontString, wrapText, type TextMetricsCtx } from '@/lib/text/render';

/** Mock context where every character is `charW` px wide. */
function mockCtx(charW = 10): TextMetricsCtx {
  return { font: '', measureText: (s: string) => ({ width: s.length * charW }) };
}

describe('fontString', () => {
  it('builds a font shorthand with weight, size and family', () => {
    expect(fontString({ italic: false, fontWeight: 700, fontFamily: 'Georgia, serif' }, 48)).toBe(
      '700 48px Georgia, serif',
    );
  });

  it('prefixes italic when set', () => {
    expect(fontString({ italic: true, fontWeight: 400, fontFamily: 'Arial' }, 32)).toBe(
      'italic 400 32px Arial',
    );
  });
});

describe('wrapText', () => {
  it('word-wraps to the max width', () => {
    expect(wrapText(mockCtx(10), 'aaaa bbbb cccc', 95)).toEqual(['aaaa bbbb', 'cccc']);
  });

  it('honors explicit newlines', () => {
    expect(wrapText(mockCtx(10), 'one\ntwo', 1000)).toEqual(['one', 'two']);
  });

  it('keeps an over-long word on its own line rather than breaking it', () => {
    expect(wrapText(mockCtx(10), 'supercalifragilistic', 50)).toEqual(['supercalifragilistic']);
  });

  it('preserves blank lines between paragraphs', () => {
    expect(wrapText(mockCtx(10), 'a\n\nb', 1000)).toEqual(['a', '', 'b']);
  });
});
