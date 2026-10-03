'use client';

import { FormEvent, useEffect, useState } from 'react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { StatusChip } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import {
  linkGoogle,
  resendVerificationEmail,
  setRecoveryEmail,
  unlinkGoogle,
  type MeProfile,
} from '@/lib/api';

/** Profile card: recovery email (for password resets) and the linked Google account. */
export function AccountRecoveryCard({
  profile,
  sessionToken,
  onProfile,
}: {
  profile: MeProfile;
  sessionToken: string;
  onProfile: (next: MeProfile) => void;
}) {
  const [email, setEmail] = useState(profile.email ?? '');
  const [busy, setBusy] = useState<'email' | 'resend' | 'google' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmail(profile.email ?? '');
  }, [profile.email]);

  const emailChanged = email.trim().toLowerCase() !== (profile.email ?? '').toLowerCase();

  async function run(kind: 'email' | 'resend' | 'google', fn: () => Promise<MeProfile>, ok: string) {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      onProfile(await fn());
      setNotice(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  }

  function onSaveEmail(e: FormEvent) {
    e.preventDefault();
    const next = email.trim();
    void run(
      'email',
      () => setRecoveryEmail(sessionToken, next),
      `We sent a confirmation link to ${next}. Open it to finish setting up recovery.`,
    );
  }

  return (
    <section className="surface-card-lg" aria-labelledby="account-recovery-heading">
      <h3 id="account-recovery-heading" className="font-heading-section">
        Account &amp; recovery
      </h3>
      <p className="mt-2 max-w-xl font-prose-muted">
        Add an email so you can reset your password if you lose it. We only use it for account
        recovery.
      </p>

      <form onSubmit={onSaveEmail} className="mt-5 flex max-w-xl flex-col gap-3">
        <TextField
          variant="form"
          label="Recovery email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          maxLength={254}
          required
        />
        <div className="flex flex-wrap items-center gap-2.5">
          {profile.email ? (
            profile.emailVerified ? (
              <StatusChip tone="positive">Confirmed</StatusChip>
            ) : (
              <StatusChip tone="amber">Waiting for confirmation</StatusChip>
            )
          ) : (
            <StatusChip tone="muted">Not set</StatusChip>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={busy !== null || !email.trim() || (!emailChanged && profile.emailVerified)}
          >
            {busy === 'email' ? 'Saving…' : profile.email ? 'Update email' : 'Save email'}
          </Button>
          {profile.email && !profile.emailVerified && !emailChanged ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                void run(
                  'resend',
                  () => resendVerificationEmail(sessionToken),
                  `Sent a new confirmation link to ${profile.email}.`,
                )
              }
            >
              {busy === 'resend' ? 'Sending…' : 'Resend link'}
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-6 max-w-xl border-t border-sidebar/10 pt-5">
        <h4 className="font-display text-sm font-semibold text-sidebar">Google sign-in</h4>
        {profile.googleLinked ? (
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <StatusChip tone="positive">Connected</StatusChip>
            {profile.hasPassword ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  void run('google', () => unlinkGoogle(sessionToken), 'Google disconnected.')
                }
              >
                {busy === 'google' ? 'Disconnecting…' : 'Disconnect Google'}
              </Button>
            ) : (
              <p className="text-xs text-muted">
                This account signs in with Google only. To disconnect it, first set a password via
                Forgot password (needs a confirmed recovery email).
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-muted">
              Connect Google to sign in with one tap. Your username and progress stay the same.
            </p>
            <div className="max-w-xs">
              <GoogleSignInButton
                text="continue_with"
                disabled={busy !== null}
                onError={setError}
                onCredential={(idToken) =>
                  void run('google', () => linkGoogle(sessionToken, idToken), 'Google connected.')
                }
              />
            </div>
          </div>
        )}
      </div>

      {notice && (
        <Notice tone="positive" role="status" className="mt-5">
          {notice}
        </Notice>
      )}
      {error && (
        <Notice tone="danger" role="alert" className="mt-5">
          {error}
        </Notice>
      )}
    </section>
  );
}
