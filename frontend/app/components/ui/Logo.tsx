interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Animal Spirits mark — a single deliberate glyph: a spike-and-tail that reads
 * as a candlestick, a heartbeat, and a swarm of agents collapsing to one
 * decision. Rendered as a pure SVG; no gradient, no shadow.
 */
export function Logo({ size = 18, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx="4.5"
        stroke="currentColor"
      />
      <path
        d="M4 16 L8 11 L11 14 L14 7 L17 13 L20 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <circle cx="14" cy="7" r="1.6" fill="currentColor" />
    </svg>
  );
}
