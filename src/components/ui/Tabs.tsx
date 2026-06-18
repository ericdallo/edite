import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function Tabs({ items, value, onChange, className, size = 'md' }: TabsProps) {
  return (
    <div className={cn('inline-flex rounded-xl bg-surface-2 p-1', className)}>
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={cn(
            'rounded-lg font-medium transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
            value === it.id
              ? 'bg-surface-3 text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
