import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { applyAccent, applyReduceMotion, applyTheme, watchSystemTheme } from '@/lib/theme';

/**
 * Keep the document in sync with the appearance preferences (theme, accent,
 * reduce-motion). Re-applies on change and, while following the OS theme
 * ('system'), reacts to the OS appearance switching.
 */
export function useTheme(): void {
  const theme = useEditorStore((s) => s.theme);
  const accent = useEditorStore((s) => s.accent);
  const reduceMotion = useEditorStore((s) => s.reduceMotion);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [theme]);

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  useEffect(() => {
    applyReduceMotion(reduceMotion);
  }, [reduceMotion]);
}
