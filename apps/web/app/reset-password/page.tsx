'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import { resetPassword } from '@/lib/api';
import { clearStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

function ResetPasswordForm() {
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const clearSession = useSession((s) => s.clearSession);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [doneFor, setDoneFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="surface-card-lg flex flex-col gap-4">
        <StatusChip tone="danger" role="alert" className="text-sm">
          This reset link is missing its token. Open the link from the email again.
        </StatusChip>
        <Button href="/forgot-password" className="min-h-11 w-full">
          Request a new link
        </Button>
      </div>
    );
  }

  if (doneFor) {
    return (
      <div className="surface-card-lg flex flex-col gap-4">
        <StatusChip tone="positive" role="status" className="text-sm">
          Password updated for {doneFor}. You&apos;ve been signed out everywhere.
        </StatusChip>
        <Button href="/sign-in" className="min-h-11 w-full">
          Sign in
        </Button>
      </div>
    );
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
      <p className="text-sm text-muted">
        Link expired?{' '}
        <Link href="/forgot-password" className="font-semibold text-sidebar hover:underline">
          Request a new one
        </Link>
      </p>
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
