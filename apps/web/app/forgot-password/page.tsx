'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import { forgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(identifier.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lobby-page-intro mx-auto w-full max-w-md">
      <div className="mb-4 sm:mb-5">
        <h1 className="font-title-page">Forgot password</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your username or recovery email. If the account has a confirmed recovery email,
          we&apos;ll send a link to reset your password.
        </p>
      </div>
      <div className="surface-card-lg flex flex-col gap-4">
        {sent ? (
          <>
            <StatusChip tone="positive" role="status" className="text-sm">
              If that account has a confirmed recovery email, a reset link is on its way. It
              expires in 1 hour.
            </StatusChip>
            <p className="text-sm text-muted">
              No email? Check spam, or sign in and add a recovery email from your profile. Accounts
              without a confirmed email can&apos;t be recovered this way.
            </p>
            <Button href="/sign-in" className="min-h-11 w-full">
              Back to sign in
            </Button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <TextField
              variant="hud"
              label="Username or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              minLength={3}
              maxLength={254}
              autoComplete="username"
              autoFocus
            />
            {error && (
              <StatusChip tone="danger" role="alert" className="text-xs">
                {error}
              </StatusChip>
            )}
            <Button disabled={busy} type="submit" className="min-h-11 w-full">
              {busy ? 'Sending…' : 'Send reset link'}
            </Button>
            <p className="text-sm text-muted">
              Remembered it?{' '}
              <Link href="/sign-in" className="font-semibold text-sidebar hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
