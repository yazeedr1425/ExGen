import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

// Presentational primitives. These hold no state and fetch nothing — they only
// map props onto the class names defined in globals.css, so restyling the app is
// a stylesheet edit rather than a component sweep.

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'default' | 'ghost';
  size?: 'md' | 'lg';
  loading?: boolean;
};

export function Button({
  variant = 'default',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant === 'primary' ? 'btn-primary' : '',
    variant === 'ghost' ? 'btn-ghost' : '',
    size === 'lg' ? 'btn-lg' : '',
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
  className = '',
}: {
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return <div className={`card ${flush ? 'card-flush' : ''} ${className}`}>{children}</div>;
}

export function CardHead({ children }: { children: ReactNode }) {
  return <div className="card-head">{children}</div>;
}

type Tone = 'neutral' | 'active' | 'ok' | 'warn' | 'err';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      {children}
      {hint && <div className="hint" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />;
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
    <div className={`notice notice-${tone}`} role={tone === 'err' ? 'alert' : undefined}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
