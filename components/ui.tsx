import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

// Presentational primitives mapped onto the PlugThis component classes in
// globals.css, so restyling stays a stylesheet edit rather than a component sweep.

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'default' | 'ghost' | 'quiet';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant === 'ghost' ? 'btn-ghost' : '',
    variant === 'default' || variant === 'quiet' ? 'btn-quiet' : '',
    size === 'lg' ? 'btn-lg' : '',
    size === 'sm' ? 'btn-sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Card({
  children,
  flush = false,
  pad = true,
  className = '',
}: {
  children: ReactNode;
  flush?: boolean;
  pad?: boolean;
  className?: string;
}) {
  return (
    <div className={`card ${flush ? 'card-flush' : pad ? 'card-pad' : ''} ${className}`}>{children}</div>
  );
}

export function CardHead({ children }: { children: ReactNode }) {
  return <div className="card-head">{children}</div>;
}

type Tone = 'neutral' | 'active' | 'ok' | 'warn' | 'err' | 'dark';

const BADGE_CLASS: Record<Tone, string> = {
  neutral: '',
  active: 'badge-dark',
  ok: 'badge-ok',
  warn: 'badge-warn',
  err: 'badge-err',
  dark: 'badge-dark',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${BADGE_CLASS[tone]}`}>{children}</span>;
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      {children}
      {hint && <span className="field-note">{hint}</span>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="pill-input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="composer-input" {...props} />;
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'err';
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`notice ${tone === 'err' ? 'notice-err' : ''}`} role={tone === 'err' ? 'alert' : undefined}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
