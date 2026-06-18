import { cn } from '@/lib/utils';

export interface BrandLogoProps {
  className?: string;
  showBadge?: boolean;
}

export function BrandLogo({ className, showBadge = true }: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)} aria-label="edite home">
      <div className="relative grid h-9 w-9 place-items-center rounded-[1.05rem] bg-canvas shadow-xl shadow-brand/25 ring-1 ring-white/10">
        <div className="absolute inset-0 rounded-[1.05rem] bg-gradient-to-br from-brand-bright via-brand to-accent opacity-95" />
        <div className="absolute inset-[3px] rounded-[0.85rem] bg-canvas/20 backdrop-blur-sm" />
        <svg
          className="relative z-10 h-6 w-6 drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 9.6C9 8.5 10.2 7.8 11.2 8.4L23 15.2C24 15.8 24 17.2 23 17.8L11.2 24.6C10.2 25.2 9 24.5 9 23.4V9.6Z"
            fill="white"
          />
          <path d="M11.5 12.4L19.2 16.8L11.5 21.2V12.4Z" fill="#0A0A11" fillOpacity="0.22" />
          <path d="M7 8.5H4.8V23.5H7" stroke="white" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round" />
          <path d="M25 8.5H27.2V23.5H25" stroke="white" strokeOpacity="0.9" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="bg-gradient-to-r from-white via-ink to-brand-bright bg-clip-text text-xl font-black tracking-[-0.06em] text-transparent">
          edite
        </span>
        {showBadge && (
          <span className="hidden rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted shadow-inner shadow-white/5 sm:inline">
            free
          </span>
        )}
      </div>
    </div>
  );
}
