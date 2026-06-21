import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';

/**
 * Makes the browser Back button / gesture undo instead of leaving the editor
 * (a common Android frustration).
 *
 * While there are edits to undo we keep one extra "buffer" entry on the history
 * stack. Pressing Back pops that buffer and fires popstate, where we run undo
 * and — as long as more steps remain — re-arm the buffer. Once the undo stack
 * is empty the buffer isn't replaced, so the next Back leaves the page as usual.
 */
export function useNavigationGuard(): void {
  useEffect(() => {
    let armed = false;
    const arm = () => {
      if (armed) return;
      try {
        history.pushState({ editeGuard: true }, '');
        armed = true;
      } catch {
        // pushState can throw in sandboxed contexts; just skip the guard.
      }
    };

    const onPopState = () => {
      // The buffer entry was consumed by this Back press.
      armed = false;
      const s = useEditorStore.getState();
      // Nothing to undo (or not in the editor): let the navigation proceed.
      if (s.view !== 'editor' || s.past.length === 0) return;
      s.undo();
      // Re-arm only while more undo steps remain, so Back walks the edit stack
      // and then exits.
      if (useEditorStore.getState().past.length > 0) arm();
    };

    // Keep a buffer armed whenever there's undo history worth protecting.
    const sync = () => {
      const s = useEditorStore.getState();
      if (s.view === 'editor' && s.past.length > 0) arm();
    };
    const unsubscribe = useEditorStore.subscribe(sync);
    sync();

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      unsubscribe();
    };
  }, []);
}
