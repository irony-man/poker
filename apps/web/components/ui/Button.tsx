import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

const variants = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  positive:
    'rounded-lg border border-positive/35 bg-positive/10 px-3 py-2 text-sm font-medium text-positive transition hover:bg-positive/15 disabled:opacity-50',
  dangerQuiet:
    'rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50',
  soft: 'inline-flex items-center justify-center rounded border border-sidebar/20 bg-white px-2 font-display font-bold uppercase tracking-wide text-sidebar shadow-[0_2px_8px_rgb(29_4_50/0.06)] transition hover:border-sidebar/35 hover:bg-sidebar/5 disabled:opacity-50',
  chrome: 'play-chrome-control',
  chromeActive: 'play-chrome-control play-chrome-control-active',
  chromeDanger:
    'play-chrome-control border-danger/25 text-danger hover:border-danger/40 hover:bg-danger/10',
  chromeLeave: 'play-chrome-leave',
} as const;

const sizes = {
  md: '',
  sm: 'min-h-9 px-3 py-2 text-xs',
  icon: 'inline-flex h-9 w-9 shrink-0 items-center justify-center !min-h-0 !min-w-0 !w-9 !px-0 !py-0 p-0 !rounded-xl',
  compact: 'inline-flex items-center justify-center !rounded py-2 text-xs',
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
): string {
  if (variant === 'chrome' && size === 'icon') {
    return ['play-chrome-control-icon', className].filter(Boolean).join(' ');
  }
  return [variants[variant], sizes[size], className].filter(Boolean).join(' ');
}

type ButtonBase = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
};

type ButtonAsButton = ButtonBase &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    href?: undefined;
  };

type ButtonAsLink = ButtonBase & {
  href: string;
  disabled?: boolean;
  title?: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', children, href, ...props },
  ref,
) {
  const cls = buttonClass(variant, size, className);
  if (href) {
    const { disabled, title } = props as ButtonAsLink;
    return (
      <Link
        href={href}
        className={cls}
        title={title}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={disabled ? (e) => e.preventDefault() : undefined}
      >
        {children}
      </Link>
    );
  }
  const buttonProps = props as ButtonAsButton;
  return (
    <button type="button" className={cls} ref={ref} {...buttonProps}>
      {children}
    </button>
  );
});
