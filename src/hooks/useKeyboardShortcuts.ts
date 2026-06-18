import { useEffect } from 'react';
import type { Clip } from '@/types/editor';
import { useEditorStore } from '@/store/editorStore';
import { clipEnd, projectDuration } from '@/lib/timeline';
import { clamp } from '@/lib/utils';

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

function boundaries(clips: Clip[], total: number): number[] {
  const set = new Set<number>([0, total]);
  for (const c of clips) {
    set.add(c.start);
    set.add(clipEnd(c));
  }
  return [...set].sort((a, b) => a - b);
}

/** Nearest clip edge (or 0 / end) in a direction — used by Ctrl+Arrow. */
function nextBoundary(clips: Clip[], t: number, dir: number, total: number): number {
  const bs = boundaries(clips, total);
  if (dir > 0) return bs.find((b) => b > t + 0.001) ?? total;
  let prev = 0;
  for (const b of bs) {
    if (b < t - 0.001) prev = b;
    else break;
  }
  return prev;
}

/** Global editor shortcuts matching common online video editors. */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditorStore.getState();
      if (isTyping()) return;

      // Undo/redo work even with no media (so redo is reachable after undoing to empty).
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) s.redo();
          else s.undo();
          return;
        }
        if (k === 'y') {
          e.preventDefault();
          s.redo();
          return;
        }
      }

      if (s.media.length === 0) return;

      // Caret movement (with modifiers) — handled before the Ctrl letter combos.
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        s.setPlaying(false);
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const total = projectDuration(s.clips);
        if (e.ctrlKey || e.metaKey) {
          // jump to the previous / next clip edge
          s.setCurrentTime(nextBoundary(s.clips, s.playback.currentTime, dir, total));
        } else {
          const step = e.shiftKey ? 1 : 1 / 30;
          s.setCurrentTime(clamp(s.playback.currentTime + dir * step, 0, total));
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'c':
            if (s.activeClipId) {
              e.preventDefault();
              s.copyClip(s.activeClipId);
            }
            return;
          case 'v':
            e.preventDefault();
            s.pasteClip(s.playback.currentTime);
            return;
          case 'd':
            if (s.activeClipId) {
              e.preventDefault();
              s.duplicateClip(s.activeClipId);
            }
            return;
          case '=':
          case '+':
            e.preventDefault();
            s.setZoom(s.zoom * 1.3);
            return;
          case '-':
            e.preventDefault();
            s.setZoom(s.zoom / 1.3);
            return;
          case '0':
            e.preventDefault();
            s.setZoom(1);
            return;
          default:
            return;
        }
      }

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          s.setPlaying(!s.playback.playing);
          break;
        case 's':
          e.preventDefault();
          s.splitAt(s.playback.currentTime);
          break;
        case 'm':
          e.preventDefault();
          s.toggleMute();
          break;
        case 'Delete':
        case 'Backspace':
          if (s.activeClipId) {
            e.preventDefault();
            s.deleteClip(s.activeClipId);
          }
          break;
        case 'Home':
          e.preventDefault();
          s.setPlaying(false);
          s.setCurrentTime(0);
          break;
        case 'End':
          e.preventDefault();
          s.setPlaying(false);
          s.setCurrentTime(projectDuration(s.clips));
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
