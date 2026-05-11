"use client";

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Oblivion SVG logomark: gradient-stroked void circle per LOGO-BRIEF.md.
 * A circle with a Solana purple-to-green gradient stroke, void interior.
 * Used as icon-only at favicon/avatar scale; wordmark uses text-gradient CSS.
 */
export function LogoMark({ size = 24, className = "" }: LogoProps) {
  const id = "oblivion-logo-gradient";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9945FF" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke={`url(#${id})`}
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

/**
 * Logomark + gradient wordmark lockup for nav usage.
 */
export function LogoLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={20} />
      <span className="text-gradient text-[1.25rem] font-semibold leading-none tracking-[-0.01em]">
        Oblivion
      </span>
    </span>
  );
}
