'use client';

import { FormEvent, useState } from 'react';
import type { AuthSession } from '@poker/protocol';
import { GoogleSignInButton, OrDivider } from '@/components/GoogleSignInButton';
import { InstagramSignInButton } from '@/components/InstagramSignInButton';
import { AvatarPicker } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import { googleAuth, isGoogleNeedsUsername } from '@/lib/api';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';

type PendingGoogle = { idToken: string; email: string | null };

/**
 * "Continue with Google" plus the one-time username step for brand-new Google users.
 * While that step is open the parent should hide its password form (`onStepChange(true)`).
 */
export function GoogleAuthPanel({
  mode,
  onSession,
  onStepChange,
  initialAvatarId,
  returnTo,
}: {
  mode: 'sign-in' | 'sign-up';
  onSession: (session: AuthSession) => void;
  onStepChange?: (choosingUsername: boolean) => void;
  initialAvatarId?: number;
  returnTo?: string;
}) {
  const [pending, setPending] = useState<PendingGoogle | null>(null);
  const [username, setUsername] = useState('');
  const [avatarId, setAvatarId] = useState(() =>
    initialAvatarId ?? (typeof window !== 'undefined' ? loadSavedAvatarId() : 0),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [instagramAvailable, setInstagramAvailable] = useState(false);

  function openStep(next: PendingGoogle | null) {
    setPending(next);
    onStepChange?.(next !== null);
  }

  async function onCredential(idToken: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await googleAuth(idToken);
      if (isGoogleNeedsUsername(result)) {
        setUsername(result.suggestedUsername);
        openStep({ idToken, email: result.email });
        return;
      }
      onSession(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await googleAuth(pending.idToken, {
        username: username.trim(),
        avatarId,
      });
      if (isGoogleNeedsUsername(result)) {
        setError('Please choose a username');
        return;
      }
      saveAvatarId(avatarId);
      onSession(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create account';
      // Google ID tokens expire after ~1 hour; send the user back to the button.
      if (/google sign-in failed/i.test(message)) {
        openStep(null);
        setError('Your Google sign-in expired. Please continue with Google again.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <form onSubmit={onCreate} className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading-section">Pick a username</h2>
          <p className="mt-1 text-sm text-muted">
            {pending.email ? (
              <>
                Signed in with Google as <span className="font-semibold">{pending.email}</span>.{' '}
              </>
            ) : null}
            This is the name other players see at the table.
          </p>
        </div>
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
          autoFocus
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
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setError(null);
            openStep(null);
          }}
          className="min-h-11 w-full"
        >
          Back
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-3">
        <GoogleSignInButton
          layout="icon"
          text={mode === 'sign-up' ? 'signup_with' : 'continue_with'}
          disabled={busy}
          onCredential={(token) => void onCredential(token)}
          onError={setError}
          onAvailable={setAvailable}
        />
        <InstagramSignInButton
          layout="icon"
          next={returnTo}
          disabled={busy}
          onError={setError}
          onAvailable={setInstagramAvailable}
          label={mode === 'sign-up' ? 'Sign up with Instagram' : 'Continue with Instagram'}
        />
      </div>
      {error && (
        <StatusChip tone="danger" role="alert" className="text-xs">
          {error}
        </StatusChip>
      )}
      {available || instagramAvailable ? <OrDivider /> : null}
    </div>
  );
}
