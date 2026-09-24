'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { authHref } from '@/lib/authRedirect';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/cn';

export function LobbyPageShell({
  title,
  subtitle,
  requireAuth = true,
  signedIn,
  error,
  fillHeight = false,
  children,
}: {
  title?: string;
  /** Optional supporting line under the H1 (full-width page header). */
  subtitle?: string;
  requireAuth?: boolean;
  signedIn: boolean;
  error?: string | null;
  /** Grow to fill lobby main (e.g. full-height chat). */
  fillHeight?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={cn('lobby-page-intro', fillHeight && 'lobby-page-fill h-full min-h-0')}>
      <header className={cn("w-full shrink-0", title && subtitle ? "mb-4 sm:mb-5" : "mb-0")}>
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
          <p className="mt-2 text-sm text-muted">
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
      <div className={cn('min-h-0 w-full', fillHeight && 'flex min-h-0 flex-1 flex-col')}>
        {children}
      </div>
    </div>
  );
}
