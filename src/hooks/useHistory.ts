import { useEffect } from 'react';
import { docsEqual, selectDoc, useEditorStore } from '@/store/editorStore';

/**
 * Records undo/redo checkpoints. Document changes are coalesced into a single
 * history entry per interaction: nothing is committed while a pointer is down
 * (so a whole drag/trim/slider gesture is one step), and keyboard bursts are
 * debounced. commitHistory() itself is a no-op when the document is unchanged,
 * so restores (persistence/undo/redo) never create spurious entries.
 */
export function useHistory(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pointerDown = false;
    let last = selectDoc(useEditorStore.getState());

    const commit = () => useEditorStore.getState().commitHistory();
    const schedule = (delay = 350) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (pointerDown) {
          schedule();
          return;
        }
        commit();
      }, delay);
    };

    const onDown = () => {
      pointerDown = true;
    };
    const onUp = () => {
      pointerDown = false;
      schedule(0);
    };

    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);

    const unsubscribe = useEditorStore.subscribe((state) => {
      const doc = selectDoc(state);
      if (docsEqual(doc, last)) return;
      last = doc;
      schedule();
    });

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      unsubscribe();
    };
  }, []);
}
