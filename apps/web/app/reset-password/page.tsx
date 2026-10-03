'use client';

import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { StatusChip } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import { checkResetToken, resetPassword } from '@/lib/api';
import { clearStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

type LinkState = 'checking' | 'valid' | 'invalid';

function InvalidLink({ message }: { message: string }) {
  return (
    <div className="surface-card-lg flex flex-col gap-4">
      <Notice tone="danger" role="alert" title={message}>
        Reset links work once and expire after an hour. Request a new one and use the latest
        email.
      </Notice>
      <Button href="/forgot-password" className="min-h-11 w-full">
        Request a new link
      </Button>
    </div>
  );
}

function ResetPasswordForm() {
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const clearSession = useSession((s) => s.clearSession);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneFor, setDoneFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkState, setLinkState] = useState<LinkState>(token ? 'checking' : 'invalid');

  useEffect(() => {
    if (!token) {
      setLinkState('invalid');
      return;
    }
    let cancelled = false;
    setLinkState('checking');
    void checkResetToken(token)
      .then((valid) => {
        if (!cancelled) setLinkState(valid ? 'valid' : 'invalid');
      })
      .catch(() => {
        // Can't tell (network/server) — show the form; submit reports the real error.
        if (!cancelled) setLinkState('valid');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { username } = await resetPassword(token, password);
      // Every session for the account was revoked server-side, including this browser's.
      clearStoredSession();
      clearSession();
      setDoneFor(username);
    } catch (err) {
      const stillValid = await checkResetToken(token).catch(() => true);
      if (!stillValid) {
        setLinkState('invalid');
      } else {
        setError(err instanceof Error ? err.message : 'Could not reset password');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <InvalidLink message="This reset link is missing its token. Open the link from the email again." />
    );
  }

  if (doneFor) {
    return (
      <div className="surface-card-lg flex flex-col gap-4">
        <Notice tone="positive" role="status" title={`Password updated for ${doneFor}`}>
          You&apos;ve been signed out everywhere. Sign in with your new password.
        </Notice>
        <Button href="/sign-in" className="min-h-11 w-full">
          Sign in
        </Button>
      </div>
    );
  }

  if (linkState === 'checking') {
    return <LoadingScreen compact label="Checking your link…" />;
  }

  if (linkState === 'invalid') {
    return <InvalidLink message="This reset link is invalid or has expired." />;
  }

  return (
    <form onSubmit={onSubmit} className="surface-card-lg flex flex-col gap-4">
      <TextField
        variant="hud"
        label="New password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        maxLength={128}
        autoComplete="new-password"
        help="At least 6 characters"
        autoFocus
      />
      <TextField
        variant="hud"
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        minLength={6}
        maxLength={128}
        autoComplete="new-password"
      />
      {error && (
        <StatusChip tone="danger" role="alert" className="text-xs">
          {error}
        </StatusChip>
      )}
      <Button disabled={busy} type="submit" className="min-h-11 w-full">
        {busy ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="lobby-page-intro mx-auto w-full max-w-md">
      <div className="mb-4 sm:mb-5">
        <h1 className="font-title-page">Reset password</h1>
        <p className="mt-2 text-sm text-muted">Choose a new password for your account.</p>
      </div>
      <Suspense fallback={<LoadingScreen compact label="Loading…" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
