import type { ReactNode } from "react";

interface PanelProps {
  title?: ReactNode;
  caption?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}

/**
 * The base panel: a hairline border on a one-step-up surface. Title and
 * caption sit in the header; right slot accepts inline controls.
 */
export function Panel({
  title,
  caption,
  right,
  children,
  className,
  bodyClassName,
  flush,
}: PanelProps) {
  return (
    <section
      className={`flex flex-col border border-[var(--color-line)] bg-[var(--color-surface)] ${className ?? ""}`}
    >
      {(title || right) && (
        <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <div className="flex items-baseline gap-3">
            {title && (
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-fg-muted)]">
                {title}
              </h3>
            )}
            {caption && (
              <span className="text-[11px] text-[var(--color-fg-faint)]">
                {caption}
              </span>
            )}
          </div>
          {right}
        </header>
      )}
      <div className={flush ? bodyClassName : `p-4 ${bodyClassName ?? ""}`}>
        {children}
      </div>
    </section>
  );
}
