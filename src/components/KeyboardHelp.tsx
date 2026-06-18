import { useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space / K', action: 'Play / pause' },
  { keys: 'S', action: 'Split at playhead' },
  { keys: 'Del / ⌫', action: 'Delete selected clip' },
  { keys: '← / →', action: 'Nudge playhead one frame' },
  { keys: 'Shift + ← / →', action: 'Move playhead by 1s' },
  { keys: '⌘/Ctrl + ← / →', action: 'Jump to clip edges' },
  { keys: 'Home / End', action: 'Jump to start / end' },
  { keys: 'M', action: 'Mute / unmute' },
  { keys: '⌘/Ctrl + C', action: 'Copy clip' },
  { keys: '⌘/Ctrl + V', action: 'Paste clip' },
  { keys: '⌘/Ctrl + D', action: 'Duplicate clip' },
  { keys: '⌘/Ctrl + / −', action: 'Zoom timeline' },
  { keys: '⌘/Ctrl + 0', action: 'Reset zoom' },
];

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Keyboard shortcuts"
        aria-label="Keyboard shortcuts"
        className="grid h-9 w-9 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Keyboard size={18} />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts">
        <div className="grid gap-1">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
            >
              <span className="text-ink-muted">{s.action}</span>
              <kbd className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
}
