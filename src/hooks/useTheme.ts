import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { applyTheme, watchSystemTheme } from '@/lib/theme';

/**
 * Keep the document in sync with the chosen theme. Re-applies on change and,
 * while following the OS ('system'), reacts to the OS appearance switching.
 */
export function useTheme(): void {
  const theme = useEditorStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [theme]);
}
