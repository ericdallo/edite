import { cn } from '@/lib/utils';

export interface BrandLogoProps {
  className?: string;
  /** Where the logo links to. Defaults to the site root. */
  href?: string;
}

export function BrandLogo({ className, href = '/' }: BrandLogoProps) {
  return (
    <a
      href={href}
      title="edite — home"
      aria-label="edite home"
      className={cn(
        'flex items-center gap-3 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand/60',
        className,
      )}
    >
      <svg
        className="h-10 w-10 drop-shadow-[0_8px_18px_rgba(139,92,246,0.24)]"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="edite-logo-left" x1="10" y1="12" x2="34" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a78bfa" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="edite-logo-right" x1="30" y1="12" x2="54" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <path
          d="M14 24C14 18.5 18.5 14 24 14H33"
          stroke="url(#edite-logo-left)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M14 40C14 45.5 18.5 50 24 50H33"
          stroke="url(#edite-logo-left)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M50 24C50 18.5 45.5 14 40 14H37"
          stroke="url(#edite-logo-right)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M50 40C50 45.5 45.5 50 40 50H37"
          stroke="url(#edite-logo-right)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M27 24.9C27 23.5 28.6 22.6 29.8 23.4L40.4 30.5C41.5 31.2 41.5 32.8 40.4 33.5L29.8 40.6C28.6 41.4 27 40.5 27 39.1V24.9Z"
          fill="white"
        />
      </svg>
      <span className="hidden text-[1.35rem] font-extrabold lowercase leading-none tracking-[-0.065em] text-ink antialiased sm:block">
        edite
      </span>
    </a>
  );
}
