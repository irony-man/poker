'use client';

import Link from 'next/link';
import { authHref } from '@/lib/authRedirect';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

export function HomeAuthFooter() {
  const { authReady, signedIn } = useLobbySession();
  const pageCopy = usePageCopy('homeAuthFooter');

  if (!authReady || signedIn) {
    return null;
  }

  return (
    <p className="lobby-fade-up lobby-fade-up-delay-3 mt-16 text-center text-sm text-ink-strong-muted sm:mt-20">
      {pageCopy.title}{' '}
      <Link
        href={authHref('sign-in', '/')}
        className="font-display font-semibold uppercase tracking-wider text-sidebar underline-offset-4 hover:underline"
      >
        Sign in
      </Link>
      {' · '}
      <Link
        href={authHref('sign-up', '/')}
        className="font-display font-semibold uppercase tracking-wider text-sidebar underline-offset-4 hover:underline"
      >
        Create account
      </Link>
    </p>
  );
}
