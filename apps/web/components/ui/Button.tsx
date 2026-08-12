import type { ButtonHTMLAttributes, ReactNode } from 'react';

const variants = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  positive:
    'rounded-lg border border-positive/35 bg-positive/10 px-3 py-2 text-sm font-medium text-positive transition hover:bg-positive/15 disabled:opacity-50',
  dangerQuiet:
    'rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50',
} as const;

export type ButtonVariant = keyof typeof variants;

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <button type="button" className={`${variants[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
