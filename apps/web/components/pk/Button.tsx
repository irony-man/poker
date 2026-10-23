'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const variants = {
  primary: 'bg-chrome text-on-chrome hover:opacity-90',
  secondary: 'bg-raised text-primary border border-subtle/40',
  ghost: 'bg-transparent text-primary hover:bg-raised',
  danger: 'bg-danger text-white',
  icon: 'bg-raised text-primary border border-subtle/30',
} as const;

export type PkButtonVariant = keyof typeof variants;

type Common = {
  variant?: PkButtonVariant;
  children: ReactNode;
  className?: string;
};

export function pkButtonClass(variant: PkButtonVariant = 'primary', className?: string): string {
  return cn(
    'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-pk-md px-pk-4 py-2 font-pk-display text-pk-label font-semibold',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant],
    className,
  );
}

export function PkButton({
  variant = 'primary',
  className,
  children,
  ...props
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={pkButtonClass(variant, className)} {...props}>
      {children}
    </button>
  );
}

export function PkLinkButton({
  href,
  variant = 'primary',
  className,
  children,
}: Common & { href: string }) {
  return (
    <Link href={href} className={pkButtonClass(variant, className)}>
      {children}
    </Link>
  );
}
