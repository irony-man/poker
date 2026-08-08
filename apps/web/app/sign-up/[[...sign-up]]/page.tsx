'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { AvatarPicker } from '@/components/PlayerAvatar';
import { signup } from '@/lib/api';
import { authHref, safeReturnPath } from '@/lib/authRedirect';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

function SignUpForm() {
  const router = useRouter();
  const search = useSearchParams();
  const setSession = useSession((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatarId, setAvatarId] = useState(() =>
    typeof window !== 'undefined' ? loadSavedAvatarId() : 0,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnTo = safeReturnPath(search.get('next'));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await signup(username.trim(), password, avatarId);
      const stored = { ...session, avatarId: session.avatarId ?? avatarId };
      setSession(stored);
      writeStoredSession(stored);
      saveAvatarId(stored.avatarId);
      router.replace(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lobby-fade-up flex w-full flex-col justify-start">
      <div className="mb-4 sm:mb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-strong sm:text-4xl">
          Create account
        </h1>
        <p className="mt-2 text-sm text-ink-strong-muted">Create a username and password</p>
      </div>
      <form onSubmit={onSubmit}>
        <LobbySplitCard imageSrc="/home-knockout.png" imageAlt="Join the table — create your account">
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
            <span className="field-help">
              Letters, numbers, and underscores · 3–24 characters
            </span>
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
              maxLength={128}
              autoComplete="new-password"
            />
            <span className="field-help">At least 6 characters</span>
          </label>
          <AvatarPicker
            value={avatarId}
            onChange={(id) => {
              setAvatarId(id);
              saveAvatarId(id);
            }}
          />
          {error && (
            <p role="alert" className="status-chip border-danger/30 bg-danger/10 text-danger text-xs">
              {error}
            </p>
          )}
          <button disabled={busy} type="submit" className="btn-primary min-h-11 w-full">
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <p className="text-sm text-ink-strong-muted">
            Already have an account?{' '}
            <Link
              href={authHref('sign-in', returnTo)}
              className="font-semibold text-sidebar hover:underline"
            >
              Sign in
            </Link>
          </p>
        </LobbySplitCard>
      </form>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<p className="text-ink-strong-muted pt-4">Loading…</p>}>
      <SignUpForm />
    </Suspense>
  );
}
