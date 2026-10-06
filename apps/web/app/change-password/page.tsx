'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { changePassword, fetchMe } from '@/lib/api';
import { readStoredSession, writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';

export default function ChangePasswordPage() {
  const { authReady, signedIn } = useLobbySession();
  const sessionToken = useSession((s) => s.sessionToken);
  const setSession = useSession((s) => s.setSession);
  const token = sessionToken ?? readStoredSession()?.sessionToken ?? null;

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchMe(token)
      .then((me) => {
        if (!cancelled) setHasPassword(me.hasPassword);
      })
      .catch(() => {
        if (!cancelled) setHasPassword(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (next !== confirm) {
      setError('New passwords do not match');
      return;
    }
    if (hasPassword && next === current) {
      setError('Choose a password different from your current one');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await changePassword(token, next, hasPassword ? current : undefined);
      const stored = { ...session, avatarId: session.avatarId ?? readStoredSession()?.avatarId };
      setSession(stored);
      writeStoredSession(stored);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) return <LoadingScreen label="Loading…" />;

  const setting = hasPassword === false;

  return (
    <LobbyPageShell signedIn={signedIn} requireAuth>
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/profile"
          className="text-xs font-display font-semibold uppercase tracking-wider text-sidebar/70 hover:text-sidebar"
        >
          ← Profile
        </Link>
        <h1 className="mt-3 font-title-page">{setting ? 'Set a password' : 'Change password'}</h1>
        <p className="mt-2 text-sm text-muted">
          {setting
            ? 'Add a password so you can also sign in with your username.'
            : 'Other devices will be signed out. You stay signed in here.'}
        </p>

        {hasPassword === null ? (
          <LoadingScreen compact label="Loading…" />
        ) : done ? (
          <div className="surface-card-lg mt-5 flex flex-col gap-4">
            <Notice tone="positive" role="status" title="Password updated">
              Other devices have been signed out. Use your new password next time you sign in.
            </Notice>
            <Button href="/profile" className="min-h-11 w-full">
              Back to profile
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="surface-card-lg mt-5 flex flex-col gap-4">
            {!setting ? (
              <TextField
                variant="form"
                label="Current password"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                maxLength={128}
                autoComplete="current-password"
                autoFocus
              />
            ) : null}
            <TextField
              variant="form"
              label="New password"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              help="At least 6 characters"
              autoFocus={setting}
            />
            <TextField
              variant="form"
              label="Confirm new password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
            />
            {error ? (
              <Notice tone="danger" role="alert">
                {error}
              </Notice>
            ) : null}
            <Button disabled={busy} type="submit" className="min-h-11 w-full">
              {busy ? 'Saving…' : setting ? 'Set password' : 'Update password'}
            </Button>
            {!setting ? (
              <p className="text-center text-xs text-muted">
                Forgot it?{' '}
                <Link href="/forgot-password" className="font-semibold text-sidebar underline">
                  Reset by email
                </Link>
              </p>
            ) : null}
          </form>
        )}
      </div>
    </LobbyPageShell>
  );
}
