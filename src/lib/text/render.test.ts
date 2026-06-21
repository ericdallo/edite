import { describe, expect, it } from 'vitest';
import { drawText, fontString, wrapText, type TextMetricsCtx } from '@/lib/text/render';
import { DEFAULT_TEXT_STYLE } from '@/types/editor';

/** Mock context where every character is `charW` px wide. */
function mockCtx(charW = 10): TextMetricsCtx {
  return { font: '', measureText: (s: string) => ({ width: s.length * charW }) };
}

/** A canvas 2D context that records fill/stroke text calls (the rest are no-ops). */
function recordingCtx() {
  const calls = { fill: [] as string[], stroke: [] as string[] };
  const ctx = {
    font: '',
    textBaseline: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    miterLimit: 0,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    clearRect() {},
    save() {},
    restore() {},
    fillRect() {},
    measureText: (s: string) => ({ width: s.length * 10 }),
    fillText: (s: string) => calls.fill.push(s),
    strokeText: (s: string) => calls.stroke.push(s),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
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

describe('drawText outline', () => {
  const box = { boxW: 200, boxH: 100, canvasH: 100 };

  it('only fills each line when there is no outline', () => {
    const { ctx, calls } = recordingCtx();
    drawText(ctx, { ...DEFAULT_TEXT_STYLE, content: 'a\nb', strokeWidth: 0 }, box);
    expect(calls.fill).toEqual(['a', 'b']);
    expect(calls.stroke).toEqual([]);
  });

  it('strokes then fills each line when an outline is set', () => {
    const { ctx, calls } = recordingCtx();
    drawText(ctx, { ...DEFAULT_TEXT_STYLE, content: 'a\nb', strokeWidth: 0.08, strokeColor: '#000' }, box);
    expect(calls.stroke).toEqual(['a', 'b']);
    expect(calls.fill).toEqual(['a', 'b']);
  });
});

describe('drawText karaoke highlight', () => {
  const box = { boxW: 300, boxH: 100, canvasH: 100 };

  /** A recording context that captures the fillStyle in effect at each fillText. */
  function colorCtx() {
    const calls: { text: string; fill: string }[] = [];
    const ctx = {
      font: '',
      textBaseline: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineJoin: '',
      miterLimit: 0,
      globalAlpha: 1,
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetY: 0,
      clearRect() {},
      save() {},
      restore() {},
      fillRect() {},
      measureText: (s: string) => ({ width: s.length * 10 }),
      fillText(s: string) {
        calls.push({ text: s, fill: this.fillStyle as string });
      },
      strokeText() {},
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
  }

  it('paints the first N words in the highlight color, the rest in the base color', () => {
    const { ctx, calls } = colorCtx();
    drawText(
      ctx,
      { ...DEFAULT_TEXT_STYLE, content: 'one two three', color: '#ffffff' },
      box,
      { count: 2, color: '#ff0000' },
    );
    expect(calls.map((c) => c.text)).toEqual(['one', 'two', 'three']);
    expect(calls.map((c) => c.fill)).toEqual(['#ff0000', '#ff0000', '#ffffff']);
  });

  it('renders whole lines (no per-word split) when there is no highlight', () => {
    const { ctx, calls } = colorCtx();
    drawText(ctx, { ...DEFAULT_TEXT_STYLE, content: 'one two three' }, box);
    expect(calls.map((c) => c.text)).toEqual(['one two three']);
  });
});
