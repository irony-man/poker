'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AvatarPicker } from '@/components/PlayerAvatar';
import { signup } from '@/lib/api';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

export default function SignUpPage() {
  const router = useRouter();
  const setSession = useSession((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [avatarId, setAvatarId] = useState(() =>
    typeof window !== 'undefined' ? loadSavedAvatarId() : 0,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lobby-fade-up relative mx-auto flex min-h-full w-full max-w-md flex-col justify-center">
      <div className="relative text-center">
        <h1 className="font-serif text-3xl tracking-tight text-ink-strong sm:text-4xl">
          Create account
        </h1>
        <p className="mt-2 text-sm text-ink-strong-muted">Create a username and password</p>
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
            placeholder="letters, numbers, _"
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
            maxLength={128}
            autoComplete="new-password"
          />
        </label>
        <AvatarPicker
          value={avatarId}
          onChange={(id) => {
            setAvatarId(id);
            saveAvatarId(id);
          }}
        />
        {error && (
          <p role="alert" className="status-chip border-red-500/40 bg-red-950/50 text-red-300">
            {error}
          </p>
        )}
        <button disabled={busy} type="submit" className="btn-primary min-h-11 w-full">
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-center text-sm text-ink-strong-muted">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-sidebar font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
