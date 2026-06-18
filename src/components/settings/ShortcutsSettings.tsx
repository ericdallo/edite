const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space / K', action: 'Play / pause' },
  { keys: 'S', action: 'Split at playhead' },
  { keys: 'J', action: 'Merge selected clips' },
  { keys: '⌘/Ctrl + A', action: 'Select all clips' },
  { keys: '⌘/Ctrl/⇧ + click', action: 'Add / remove from selection' },
  { keys: 'T', action: 'Add a text overlay' },
  { keys: 'Esc', action: 'Deselect' },
  { keys: 'Del / ⌫', action: 'Delete selection' },
  { keys: '← / →', action: 'Nudge playhead one frame' },
  { keys: 'Shift + ← / →', action: 'Move playhead by 1s' },
  { keys: '⌘/Ctrl + ← / →', action: 'Jump to clip edges' },
  { keys: 'Home / End', action: 'Jump to start / end' },
  { keys: 'M', action: 'Mute / unmute' },
  { keys: '⌘/Ctrl + C', action: 'Copy selection' },
  { keys: '⌘/Ctrl + V', action: 'Paste' },
  { keys: '⌘/Ctrl + D', action: 'Duplicate selection' },
  { keys: '⌘/Ctrl + Z', action: 'Undo' },
  { keys: '⌘/Ctrl + ⇧ + Z', action: 'Redo' },
  { keys: '⌘/Ctrl + / −', action: 'Zoom timeline' },
  { keys: '⌘/Ctrl + 0', action: 'Reset zoom' },
];

export function ShortcutsSettings() {
  return (
    <div className="grid gap-1">
      {SHORTCUTS.map((s) => (
        <div key={s.keys} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
          <span className="text-ink-muted">{s.action}</span>
          <kbd className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink">
            {s.keys}
          </kbd>
        </div>
      ))}
    </div>
  );
}
