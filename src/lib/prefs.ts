/**
 * Tiny JSON-backed preference store on top of localStorage, for global UI
 * preferences that live outside any project (kept separate from the persisted
 * project document). All reads/writes are guarded so this is safe to import in
 * non-browser environments (tests, SSR) and never throws on private-mode/quota.
 */

export function readPref<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}
