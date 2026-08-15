'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { resolvePublicImage } from '@/lib/assets';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import { login } from '@/lib/api';
import { authHref, safeReturnPath } from '@/lib/authRedirect';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { usePageCopy } from '@/lib/usePageCopy';

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const setSession = useSession((s) => s.setSession);
  const pageCopy = usePageCopy('signIn');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnTo = safeReturnPath(search.get('next'));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await login(username.trim(), password);
      const avatarId = session.avatarId ?? loadSavedAvatarId();
      const stored = { ...session, avatarId };
      setSession(stored);
      writeStoredSession(stored);
      saveAvatarId(avatarId);
      router.replace(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lobby-page-intro">
      <div className="mb-4 sm:mb-5">
        <h1 className="font-title-page">
          {pageCopy.title}
        </h1>
        <p className="mt-2 text-sm text-ink-strong-muted">{pageCopy.subtitle}</p>
      </div>
      <form onSubmit={onSubmit}>
        <LobbySplitCard
          imageSrc={resolvePublicImage(pageCopy.image ?? '/home-challenge.png')}
          imageAlt={pageCopy.imageAlt ?? 'Sit down and sign in to play'}
        >
          <TextField
            variant="hud"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={24}
            autoComplete="username"
            pattern="[a-zA-Z0-9_]+"
          />
          <TextField
            variant="hud"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="current-password"
          />
          {error && (
            <StatusChip tone="danger" role="alert" className="text-xs">
              {error}
            </StatusChip>
          )}
          <Button disabled={busy} type="submit" className="min-h-11 w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-sm text-ink-strong-muted">
            No account?{' '}
            <Link
              href={authHref('sign-up', returnTo)}
              className="font-semibold text-sidebar hover:underline"
            >
              Sign up
            </Link>
          </p>
        </LobbySplitCard>
      </form>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<LoadingScreen compact label="Loading…" />}>
      <SignInForm />
    </Suspense>
  );
}
