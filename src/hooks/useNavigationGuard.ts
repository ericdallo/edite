import { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';

/**
 * Keeps the browser Back button / gesture inside the app instead of leaving the
 * site (a common Android frustration).
 *
 * While the editor is open we keep one extra "buffer" entry on the history
 * stack. Pressing Back consumes it and fires popstate, where we either undo the
 * last edit (and re-arm) or — once there's nothing left to undo — fall back to
 * the projects list. Only from the projects list does Back finally leave the
 * page, so an accidental Back never drops you straight out of an edit.
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
      // Already on the projects list (or elsewhere): let the navigation proceed.
      if (s.view !== 'editor') return;
      if (s.past.length > 0) {
        s.undo(); // walk the edit history one step (sync re-arms below)
      } else {
        s.setView('projects'); // nothing to undo: fall back to the project list
      }
    };

    // Protect the editor whenever it's open; spend the buffer if we leave it any
    // other way (e.g. the "All projects" menu) so a single Back then exits.
    const sync = () => {
      const s = useEditorStore.getState();
      if (s.view === 'editor') {
        arm();
      } else if (armed) {
        armed = false;
        try {
          history.back();
        } catch {
          // ignore: nothing to step back through.
        }
      }
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
