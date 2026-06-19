import { describe, expect, it } from 'vitest';
import { loadTheme, resolveTheme } from '@/lib/theme';

describe('resolveTheme', () => {
  it('returns the explicit choice for dark and light', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('falls back to dark for system when no matchMedia is available', () => {
    // The test environment has no window.matchMedia, so system resolves to dark.
    expect(resolveTheme('system')).toBe('dark');
  });
});

describe('loadTheme', () => {
  it('defaults to dark when storage is unavailable', () => {
    expect(loadTheme()).toBe('dark');
  });
});
