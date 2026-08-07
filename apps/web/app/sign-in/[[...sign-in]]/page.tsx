'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { login } from '@/lib/api';
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
      const next = search.get('next') || '/';
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lobby-fade-up relative flex min-h-full w-full flex-col justify-center">
      <div className="relative">
        <h1 className="font-serif text-3xl tracking-tight text-ink-strong sm:text-4xl">Sign in</h1>
        <p className="mt-2 text-sm text-ink-strong-muted">Sign in with your username</p>
      </div>
      <form onSubmit={onSubmit} className="hud-panel mt-6 w-full space-y-4 p-5 sm:mt-8 sm:p-6">
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
            placeholder="your_username"
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
          <p role="alert" className="status-chip border-red-500/40 bg-red-950/50 text-red-300">
            {error}
          </p>
        )}
        <button disabled={busy} type="submit" className="btn-primary min-h-11 w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-ink-strong-muted">
          No account?{' '}
          <Link href="/sign-up" className="text-sidebar font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<p className="text-ink-strong-muted pt-10 text-center">Loading…</p>}>
      <SignInForm />
    </Suspense>
  );
}
