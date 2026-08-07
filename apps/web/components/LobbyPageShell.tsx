'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export function LobbyPageShell({
  title,
  requireAuth = true,
  signedIn,
  error,
  children,
}: {
  title: string;
  requireAuth?: boolean;
  signedIn: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="lobby-fade-up flex min-h-full w-full flex-col justify-center">
      <header className="mb-4 shrink-0 sm:mb-6">
        <h1 className="font-serif text-3xl tracking-tight text-ink-strong sm:text-4xl">{title}</h1>
        {requireAuth && !signedIn && (
          <p className="mt-2 text-sm text-ink-strong-muted">
            You&apos;ll need an account for this —{' '}
            <Link
              href="/sign-in"
              className="font-semibold text-sidebar underline-offset-2 hover:underline"
            >
              sign in
            </Link>{' '}
            or{' '}
            <Link
              href="/sign-up"
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
