'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import { AvatarPicker } from '@/components/PlayerAvatar';
import { signup } from '@/lib/api';
import { authHref, safeReturnPath } from '@/lib/authRedirect';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { usePageCopy } from '@/lib/usePageCopy';

function SignUpForm() {
  const router = useRouter();
  const search = useSearchParams();
  const setSession = useSession((s) => s.setSession);
  const pageCopy = usePageCopy('signUp');
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
    <div className="lobby-page-intro">
      <div className="mb-4 sm:mb-5">
        <h1 className="font-title-page">
          {pageCopy.title}
        </h1>
        <p className="mt-2 text-sm text-ink-strong-muted">{pageCopy.subtitle}</p>
      </div>
      <form onSubmit={onSubmit}>
        <LobbySplitCard imageSrc="/home-knockout.png" imageAlt="Join the table — create your account">
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
            help="Letters, numbers, and underscores · 3–24 characters"
          />
          <TextField
            variant="hud"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            maxLength={128}
            autoComplete="new-password"
            help="At least 6 characters"
          />
          <AvatarPicker
            value={avatarId}
            onChange={(id) => {
              setAvatarId(id);
              saveAvatarId(id);
            }}
          />
          {error && (
            <StatusChip tone="danger" role="alert" className="text-xs">
              {error}
            </StatusChip>
          )}
          <Button disabled={busy} type="submit" className="min-h-11 w-full">
            {busy ? 'Creating…' : 'Create account'}
          </Button>
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
    <Suspense fallback={<LoadingScreen compact label="Loading…" />}>
      <SignUpForm />
    </Suspense>
  );
}
