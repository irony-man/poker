'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { authHref } from '@/lib/authRedirect';
import { StatusChip } from '@/components/ui/StatusChip';

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
    <div className="lobby-page-intro">
      <header className="mb-4 w-full shrink-0 sm:mb-5">
        {title && (
          <h1 className="font-title-page">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="font-prose-muted mt-2 max-w-2xl sm:mt-2.5 sm:text-base">
            {subtitle}
          </p>
        )}
        {requireAuth && !signedIn && (
          <p className="mt-2 text-sm text-ink-strong-muted">
            You&apos;ll need an account for this —{' '}
            <Link
              href={authHref('sign-in', pathname)}
              className="link-sidebar font-semibold"
            >
              sign in
            </Link>{' '}
            or{' '}
            <Link
              href={authHref('sign-up', pathname)}
              className="link-sidebar font-semibold"
            >
              create one
            </Link>
            .
          </p>
        )}
      </header>
      {error && (
        <StatusChip tone="danger" role="alert" className="mb-4 shrink-0 text-xs">
          {error}
        </StatusChip>
      )}
      <div className="min-h-0 w-full">{children}</div>
    </div>
  );
}
