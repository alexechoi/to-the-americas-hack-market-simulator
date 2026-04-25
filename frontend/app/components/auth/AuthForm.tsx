import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

export function AuthLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <label
        htmlFor={htmlFor}
        className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-muted)]"
      >
        {children}
      </label>
      {hint}
    </div>
  );
}

export function AuthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={`mt-2 block w-full border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-fg-faint)] outline-none transition-colors focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)] ${className ?? ""}`}
    />
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="border border-[color-mix(in_oklab,var(--color-down)_50%,var(--color-line))] bg-[color-mix(in_oklab,var(--color-down)_8%,transparent)] px-3 py-2 text-xs text-[var(--color-down)]">
      <span className="font-mono uppercase tracking-[0.18em]">Error · </span>
      {message}
    </div>
  );
}

export function AuthSubmit(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { loadingText?: string },
) {
  const { children, loadingText, disabled, className, ...rest } = props;
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`group inline-flex h-11 w-full items-center justify-center gap-2 bg-[var(--color-accent)] px-4 text-sm font-medium tracking-tight text-[var(--color-accent-ink)] transition-colors hover:bg-[#e6ff5e] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-3)] disabled:text-[var(--color-fg-faint)] ${className ?? ""}`}
    >
      {disabled && loadingText ? loadingText : children}
      <span
        aria-hidden
        className="transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </button>
  );
}

export function AuthOAuthButton({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="flex h-11 w-full items-center justify-center gap-3 border border-[var(--color-line-strong)] bg-[var(--color-surface-2)] px-4 text-sm font-medium text-[var(--color-fg)] transition-colors hover:border-[var(--color-fg-faint)] hover:bg-[var(--color-surface-3)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="relative my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-[var(--color-line)]" />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-fg-faint)]">
        {label}
      </span>
      <div className="h-px flex-1 bg-[var(--color-line)]" />
    </div>
  );
}

export const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export const AppleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);
