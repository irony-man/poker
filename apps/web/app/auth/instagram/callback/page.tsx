'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AuthSession } from '@poker/protocol';
import { AvatarPicker } from '@/components/PlayerAvatar';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { TextField } from '@/components/ui/TextField';
import {
  instagramAuth,
  isInstagramLinked,
  isInstagramNeedsUsername,
} from '@/lib/api';
import { safeReturnPath } from '@/lib/authRedirect';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { readStoredSession, writeStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

function InstagramCallbackInner() {
  const router = useRouter();
  const search = useSearchParams();
  const setSession = useSession((s) => s.setSession);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [instagramUsername, setInstagramUsername] = useState<string>('');
  const [username, setUsername] = useState('');
  const [avatarId, setAvatarId] = useState(() =>
    typeof window !== 'undefined' ? loadSavedAvatarId() : 0,
  );
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const next = safeReturnPath(search.get('next'));

  function finish(session: AuthSession, dest: string) {
    const stored = { ...session, avatarId: session.avatarId ?? loadSavedAvatarId() };
    setSession(stored);
    writeStoredSession(stored);
    saveAvatarId(stored.avatarId ?? 0);
    router.replace(dest);
  }

  useEffect(() => {
    const oauthError = search.get('error');
    const code = search.get('code');
    const state = search.get('state');
    if (oauthError) {
      setBusy(false);
      setError('Instagram sign-in was cancelled.');
      return;
    }
    if (!code || !state) {
      setBusy(false);
      setError('Instagram sign-in failed. Please try again.');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const sessionToken = readStoredSession()?.sessionToken;
        const result = await instagramAuth({ code, state }, sessionToken);
        if (cancelled) return;
        if (isInstagramLinked(result)) {
          router.replace(safeReturnPath(result.next, '/profile'));
          return;
        }
        if (isInstagramNeedsUsername(result)) {
          setPendingToken(result.pendingToken);
          setInstagramUsername(result.instagramUsername);
          setUsername(result.suggestedUsername);
          setBusy(false);
          return;
        }
        finish(result, safeReturnPath(result.next, next));
      } catch (err) {
        if (cancelled) return;
        setBusy(false);
        setError(err instanceof Error ? err.message : 'Instagram sign-in failed');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once on mount for this code/state pair.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!pendingToken) return;
    setBusy(true);
    setError(null);
    try {
      const result = await instagramAuth({
        pendingToken,
        username: username.trim(),
        avatarId,
      });
      if (isInstagramNeedsUsername(result) || isInstagramLinked(result)) {
        setError('Please choose a username');
        setBusy(false);
        return;
      }
      saveAvatarId(avatarId);
      finish(result, safeReturnPath(result.next, '/'));
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Could not create account');
    }
  }

  if (pendingToken) {
    return (
      <div className="lobby-page-intro mx-auto max-w-md">
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <div>
            <h1 className="font-title-page">Pick a username</h1>
            <p className="mt-2 text-sm text-muted">
              {instagramUsername ? (
                <>
                  Signed in with Instagram as{' '}
                  <span className="font-semibold">@{instagramUsername}</span>.{' '}
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
        </form>
      </div>
    );
  }

  return (
    <div className="lobby-page-intro mx-auto max-w-md">
      <h1 className="font-title-page">Instagram sign-in</h1>
      {busy ? (
        <p className="mt-2 text-sm text-muted">Finishing sign-in…</p>
      ) : (
        <>
          {error && (
            <StatusChip tone="danger" role="alert" className="mt-4 text-xs">
              {error}
            </StatusChip>
          )}
          <Button
            type="button"
            className="mt-4 min-h-11 w-full"
            onClick={() => router.replace('/sign-in')}
          >
            Back to sign in
          </Button>
        </>
      )}
    </div>
  );
}

export default function InstagramCallbackPage() {
  return (
    <Suspense fallback={<LoadingScreen compact label="Signing in…" />}>
      <InstagramCallbackInner />
    </Suspense>
  );
}
