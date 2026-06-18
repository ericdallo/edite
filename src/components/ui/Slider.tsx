import { cn } from '@/lib/utils';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  ariaLabel?: string;
}

export function Slider({ value, min, max, step = 0.01, onChange, className, ariaLabel }: SliderProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className={cn('edite-range', className)}
      value={value}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        background: `linear-gradient(to right, var(--color-brand) ${pct}%, var(--color-surface-3) ${pct}%)`,
      }}
    />
  );
}
