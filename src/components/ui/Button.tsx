import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-brand-bright to-brand text-white shadow-lg shadow-brand/25 hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-3 text-ink hover:bg-line',
  subtle: 'bg-surface-2 text-ink-muted hover:text-ink hover:bg-surface-3',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger/90 text-white hover:bg-danger',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  icon: 'h-9 w-9 justify-center',
  'icon-sm': 'h-8 w-8 justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-xl font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
        'disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
