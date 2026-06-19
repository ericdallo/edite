/**
 * App theme (light / dark / follow-OS). The choice is a global UI preference
 * stored in localStorage — independent of any project — and applied by toggling
 * `data-theme` on the document root, which flips the CSS color tokens defined in
 * `index.css`. Everything here is guarded so it is safe to import in non-browser
 * environments (tests, SSR).
 */

export type Theme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'edite-theme';
const THEMES: Theme[] = ['dark', 'light', 'system'];

/** The persisted theme preference, or 'dark' when unset/invalid/unavailable. */
export function loadTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'dark';
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(value as Theme) ? (value as Theme) : 'dark';
  } catch {
    return 'dark';
  }
}

/** Persist the theme preference (no-op when storage is unavailable). */
export function saveTheme(theme: Theme): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

function systemPrefersLight(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches
  );
}

/** The concrete palette to render for a preference ('system' consults the OS). */
export function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') return systemPrefersLight() ? 'light' : 'dark';
  return theme;
}

/** Apply the resolved theme to the document root. */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  // Hint native controls (form widgets, scrollbars) to match.
  document.documentElement.style.colorScheme = resolved;
}

/**
 * Call `cb` whenever the OS color scheme changes. Returns an unsubscribe
 * function; a no-op when `matchMedia` is unavailable.
 */
export function watchSystemTheme(cb: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const handler = () => cb();
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
