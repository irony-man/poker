'use client';

import { FormEvent, useEffect, useId, useState, type ReactNode } from 'react';
import { GoogleG, GoogleSignInButton } from '@/components/GoogleSignInButton';
import { InstagramGlyph, InstagramSignInButton } from '@/components/InstagramSignInButton';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { StatusChip } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import {
  linkGoogle,
  resendVerificationEmail,
  setRecoveryEmail,
  unlinkGoogle,
  unlinkInstagram,
  type MeProfile,
} from '@/lib/api';

type BusyKind = 'email' | 'resend' | 'google' | 'instagram';

/** Profile card: password, recovery email, and the linked Google / Instagram accounts. */
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
  const [busy, setBusy] = useState<BusyKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const igGradientId = useId().replace(/:/g, '');

  useEffect(() => {
    setEmail(profile.email ?? '');
  }, [profile.email]);

  const emailChanged = email.trim().toLowerCase() !== (profile.email ?? '').toLowerCase();

  async function run(kind: BusyKind, fn: () => Promise<MeProfile>, ok: string) {
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

  const canUnlinkGoogle = profile.hasPassword || profile.instagramLinked;
  const canUnlinkInstagram = profile.hasPassword || profile.googleLinked;

  return (
    <section className="surface-card-lg" aria-labelledby="account-security-heading">
      <h3 id="account-security-heading" className="font-heading-section">
        Account &amp; security
      </h3>
      <p className="mt-2 font-prose-muted">
        How you sign in, and how to get back in if you lose access.
      </p>

      <ul className="mt-5 divide-y divide-sidebar/10 overflow-hidden rounded-xl border border-sidebar/12">
        <AccountRow
          icon={<LockIcon />}
          title="Password"
          status={
            profile.hasPassword ? (
              <StatusChip tone="positive">Set</StatusChip>
            ) : (
              <StatusChip tone="muted">Not set</StatusChip>
            )
          }
          detail={
            profile.hasPassword
              ? `Sign in with your username @${profile.username} and password.`
              : 'You sign in with Google or Instagram only. Add a password to use your username too.'
          }
          action={
            <Button href="/change-password" variant="ghost" size="sm">
              {profile.hasPassword ? 'Change password' : 'Set password'}
            </Button>
          }
        />

        <AccountRow
          icon={<MailIcon />}
          title="Recovery email"
          status={
            profile.email ? (
              profile.emailVerified ? (
                <StatusChip tone="positive">Confirmed</StatusChip>
              ) : (
                <StatusChip tone="amber">Waiting for confirmation</StatusChip>
              )
            ) : (
              <StatusChip tone="muted">Not set</StatusChip>
            )
          }
          detail="Used only for password resets and account recovery."
        >
          <form onSubmit={onSaveEmail} className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <TextField
                variant="form"
                aria-label="Recovery email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={254}
                required
              />
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="submit"
                size="sm"
                className="min-h-10"
                disabled={busy !== null || !email.trim() || !emailChanged}
              >
                {busy === 'email' ? 'Saving…' : profile.email ? 'Update' : 'Save'}
              </Button>
              {profile.email && !profile.emailVerified && !emailChanged ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-10"
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
        </AccountRow>
      </ul>

      <h4 className="mt-7 font-display text-xs font-bold uppercase tracking-[0.12em] text-sidebar/70">
        Connected accounts
      </h4>
      <ul className="mt-3 divide-y divide-sidebar/10 overflow-hidden rounded-xl border border-sidebar/12">
        <AccountRow
          icon={<GoogleG />}
          title="Google"
          status={
            profile.googleLinked ? <StatusChip tone="positive">Connected</StatusChip> : null
          }
          detail={
            profile.googleLinked
              ? (profile.googleEmail ?? 'Connected. Your Google email shows here after your next Google sign-in.')
              : 'Sign in with one tap. Your username and progress stay the same.'
          }
          detailStrong={profile.googleLinked && Boolean(profile.googleEmail)}
          action={
            profile.googleLinked ? (
              canUnlinkGoogle ? (
                <Button
                  type="button"
                  variant="dangerQuiet"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() =>
                    void run('google', () => unlinkGoogle(sessionToken), 'Google disconnected.')
                  }
                >
                  {busy === 'google' ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              ) : null
            ) : (
              <div className="w-full sm:w-60">
                <GoogleSignInButton
                  text="continue_with"
                  disabled={busy !== null}
                  onError={setError}
                  onCredential={(idToken) =>
                    void run('google', () => linkGoogle(sessionToken, idToken), 'Google connected.')
                  }
                />
              </div>
            )
          }
        >
          {profile.googleLinked && !canUnlinkGoogle ? (
            <p className="mt-2 text-xs text-muted">
              Google is your only way to sign in. Set a password or connect Instagram before
              disconnecting it.
            </p>
          ) : null}
        </AccountRow>

        <AccountRow
          icon={<InstagramGlyph gradientId={igGradientId} />}
          title="Instagram"
          status={
            profile.instagramLinked ? <StatusChip tone="positive">Connected</StatusChip> : null
          }
          detail={
            profile.instagramLinked ? (
              profile.instagramUsername ? (
                <a
                  href={`https://www.instagram.com/${encodeURIComponent(profile.instagramUsername)}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  @{profile.instagramUsername}
                </a>
              ) : (
                'Connected. Your Instagram handle shows here after your next Instagram sign-in.'
              )
            ) : (
              'Sign in with your professional Instagram account.'
            )
          }
          detailStrong={profile.instagramLinked && Boolean(profile.instagramUsername)}
          action={
            profile.instagramLinked ? (
              canUnlinkInstagram ? (
                <Button
                  type="button"
                  variant="dangerQuiet"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      'instagram',
                      () => unlinkInstagram(sessionToken),
                      'Instagram disconnected.',
                    )
                  }
                >
                  {busy === 'instagram' ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              ) : null
            ) : (
              <div className="w-full sm:w-60">
                <InstagramSignInButton
                  intent="link"
                  next="/profile"
                  disabled={busy !== null}
                  onError={setError}
                  label="Connect Instagram"
                />
              </div>
            )
          }
        >
          {profile.instagramLinked && !canUnlinkInstagram ? (
            <p className="mt-2 text-xs text-muted">
              Instagram is your only way to sign in. Set a password or connect Google before
              disconnecting it.
            </p>
          ) : null}
        </AccountRow>
      </ul>

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

function AccountRow({
  icon,
  title,
  status,
  detail,
  detailStrong = false,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  status?: ReactNode;
  detail: ReactNode;
  detailStrong?: boolean;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3.5 bg-white/60 p-4 sm:gap-4 sm:p-5">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sidebar/12 bg-white text-sidebar shadow-sm"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-sm font-semibold text-primary">{title}</p>
              {status}
            </div>
            <p
              className={
                detailStrong
                  ? 'mt-0.5 truncate text-sm font-medium text-sidebar'
                  : 'mt-0.5 text-sm text-muted'
              }
            >
              {detail}
            </p>
          </div>
          {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
        </div>
        {children}
      </div>
    </li>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
