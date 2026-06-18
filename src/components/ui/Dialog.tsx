import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  dismissable?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
  dismissable = true,
}: DialogProps) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="edite-fade absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={dismissable ? onClose : undefined}
      />
      <div
        className={cn(
          'edite-pop relative w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-ink">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
            </div>
            {dismissable && (
              <button
                onClick={onClose}
                className="-mr-1 rounded-lg p-1 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
