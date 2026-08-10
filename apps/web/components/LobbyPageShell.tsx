'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { authHref } from '@/lib/authRedirect';

export function LobbyPageShell({
  title,
  subtitle,
  requireAuth = true,
  signedIn,
  error,
  children,
}: {
  title?: string;
  /** Optional supporting line under the H1 (full-width page header). */
  subtitle?: string;
  requireAuth?: boolean;
  signedIn: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="lobby-fade-up flex w-full flex-col justify-start">
      <header className="mb-4 w-full shrink-0 sm:mb-5">
        {title && (
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-strong sm:text-4xl">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-strong-muted sm:mt-2.5 sm:text-base">
            {subtitle}
          </p>
        )}
        {requireAuth && !signedIn && (
          <p className="mt-2 text-sm text-ink-strong-muted">
            You&apos;ll need an account for this —{' '}
            <Link
              href={authHref('sign-in', pathname)}
              className="font-semibold text-sidebar underline-offset-2 hover:underline"
            >
              sign in
            </Link>{' '}
            or{' '}
            <Link
              href={authHref('sign-up', pathname)}
              className="font-semibold text-sidebar underline-offset-2 hover:underline"
            >
              create one
            </Link>
            .
          </p>
        )}
      </header>
      {error && (
        <p
          role="alert"
          className="mb-4 shrink-0 status-chip border-danger/30 bg-danger/10 text-danger text-xs"
        >
          {error}
        </p>
      )}
      <div className="min-h-0 w-full">{children}</div>
    </div>
  );
}
