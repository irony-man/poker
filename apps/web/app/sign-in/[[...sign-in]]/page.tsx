'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { login } from '@/lib/api';
import { authHref, safeReturnPath } from '@/lib/authRedirect';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const setSession = useSession((s) => s.setSession);
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
    <div className="lobby-fade-up flex w-full flex-col justify-start">
      <div className="mb-4 sm:mb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-strong sm:text-4xl">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-ink-strong-muted">Sign in with your username</p>
      </div>
      <form onSubmit={onSubmit}>
        <LobbySplitCard imageSrc="/home-challenge.png" imageAlt="Sit down and sign in to play">
          <label className="block">
            <span className="hud-label">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="hud-input"
              required
              minLength={3}
              maxLength={24}
              autoComplete="username"
              pattern="[a-zA-Z0-9_]+"
            />
          </label>
          <label className="block">
            <span className="hud-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="hud-input"
              required
              minLength={6}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p role="alert" className="status-chip border-danger/30 bg-danger/10 text-danger text-xs">
              {error}
            </p>
          )}
          <button disabled={busy} type="submit" className="btn-primary min-h-11 w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
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
