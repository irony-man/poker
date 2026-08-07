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
    <div className="relative mx-auto w-full max-w-md px-1 pt-10 pb-8">
      <div className="pointer-events-none absolute -top-6 left-1/2 h-40 w-[20rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-[0.06em] text-transparent bg-clip-text bg-gradient-to-br from-gold-light via-gold to-gold-dim uppercase">
          Felt
        </h1>
        <p className="mt-2 text-cream/60 text-sm">Sign in with your username</p>
      </div>
      <form onSubmit={onSubmit} className="hud-panel mt-8 space-y-4 p-5 sm:p-6">
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
        <p className="text-center text-sm text-cream/50">
          No account?{' '}
          <Link href="/sign-up" className="text-gold hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<p className="text-cream/60 pt-10 text-center">Loading…</p>}>
      <SignInForm />
    </Suspense>
  );
}
