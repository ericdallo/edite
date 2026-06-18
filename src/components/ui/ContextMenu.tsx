import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  shortcut?: string;
  separatorBefore?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

export function ContextMenu({
  menu,
  onClose,
}: {
  menu: ContextMenuState | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  const x = Math.min(menu.x, window.innerWidth - 224);
  const y = Math.min(menu.y, window.innerHeight - (menu.items.length * 36 + 20));

  return createPortal(
    <div
      ref={ref}
      className="edite-pop fixed z-[60] min-w-[204px] overflow-hidden rounded-xl border border-line bg-surface-2 p-1 shadow-2xl"
      style={{ left: Math.max(8, x), top: Math.max(8, y) }}
    >
      {menu.items.map((it) => (
        <div key={it.id}>
          {it.separatorBefore && <div className="my-1 h-px bg-line" />}
          <button
            disabled={it.disabled}
            onClick={() => {
              it.onClick();
              onClose();
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors disabled:opacity-40',
              it.danger ? 'text-danger hover:bg-danger/15' : 'text-ink hover:bg-surface-3',
              it.disabled && 'pointer-events-none',
            )}
          >
            <span className="grid h-4 w-4 place-items-center text-ink-muted">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="font-mono text-[10px] text-ink-faint">{it.shortcut}</span>}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
