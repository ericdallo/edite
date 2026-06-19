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

/** Brand accent colour. 'violet' is the default (no override). */
export type Accent = 'violet' | 'cyan' | 'emerald' | 'rose' | 'amber';

export interface AccentOption {
  id: Accent;
  label: string;
  /** Swatch shown in the picker (the brand-bright value of the accent). */
  swatch: string;
}

export const ACCENTS: AccentOption[] = [
  { id: 'violet', label: 'Violet', swatch: '#a78bfa' },
  { id: 'cyan', label: 'Cyan', swatch: '#22d3ee' },
  { id: 'emerald', label: 'Emerald', swatch: '#34d399' },
  { id: 'rose', label: 'Rose', swatch: '#fb7185' },
  { id: 'amber', label: 'Amber', swatch: '#fbbf24' },
];

const ACCENT_KEY = 'edite-accent';
const ACCENT_IDS = ACCENTS.map((a) => a.id);

/** The persisted accent, or 'violet' when unset/invalid/unavailable. */
export function loadAccent(): Accent {
  if (typeof localStorage === 'undefined') return 'violet';
  try {
    const value = localStorage.getItem(ACCENT_KEY);
    return ACCENT_IDS.includes(value as Accent) ? (value as Accent) : 'violet';
  } catch {
    return 'violet';
  }
}

export function saveAccent(accent: Accent): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    /* ignore */
  }
}

/** Apply the accent via a root attribute (default 'violet' clears it). */
export function applyAccent(accent: Accent): void {
  if (typeof document === 'undefined') return;
  if (accent === 'violet') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = accent;
}

const REDUCE_MOTION_KEY = 'edite-reduce-motion';

function systemPrefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** The persisted reduce-motion choice; defaults to the OS preference when unset. */
export function loadReduceMotion(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const value = localStorage.getItem(REDUCE_MOTION_KEY);
    if (value === 'true') return true;
    if (value === 'false') return false;
    return systemPrefersReducedMotion();
  } catch {
    return systemPrefersReducedMotion();
  }
}

export function saveReduceMotion(on: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(REDUCE_MOTION_KEY, on ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

/** Toggle the root attribute that disables the entrance animations. */
export function applyReduceMotion(on: boolean): void {
  if (typeof document === 'undefined') return;
  if (on) document.documentElement.dataset.reduceMotion = 'true';
  else delete document.documentElement.dataset.reduceMotion;
}
