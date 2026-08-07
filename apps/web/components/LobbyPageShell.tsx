'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export function LobbyPageShell({
  title,
  requireAuth = true,
  signedIn,
  error,
  children,
  wide = false,
}: {
  title: string;
  requireAuth?: boolean;
  signedIn: boolean;
  error?: string | null;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`mx-auto w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
      <header className="mb-6">
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
          className="mb-4 status-chip border-danger/30 bg-danger/10 text-danger text-xs"
        >
          {error}
        </p>
      )}
      {children}
    </div>
  );
}
