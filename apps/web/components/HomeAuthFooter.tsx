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
        className="link-auth-footer"
      >
        Sign in
      </Link>
      {' · '}
      <Link
        href={authHref('sign-up', '/')}
        className="link-auth-footer"
      >
        Create account
      </Link>
    </p>
  );
}
