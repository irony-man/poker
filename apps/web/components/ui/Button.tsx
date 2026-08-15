import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const variants = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  positive: 'btn-positive',
  dangerQuiet: 'btn-danger-quiet',
  soft: 'btn-soft',
  pill: 'btn-pill',
  chrome: 'play-chrome-control',
  chromeActive: 'play-chrome-control play-chrome-control-active',
  chromeDanger:
    'play-chrome-control border-danger/25 text-danger hover:border-danger/40 hover:bg-danger/10',
  chromeLeave: 'play-chrome-leave',
} as const;

const sizes = {
  md: '',
  sm: 'min-h-9 px-3 py-2 text-xs',
  icon: 'inline-flex h-9 w-9 shrink-0 items-center justify-center p-0 rounded-xl',
  compact: 'inline-flex items-center justify-center rounded py-2 text-xs',
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
): string {
  if (variant === 'chrome' && size === 'icon') {
    return cn('play-chrome-control-icon', className);
  }
  return cn(variants[variant], sizes[size], className);
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
