'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { LudoView } from '@/components/ludo/LudoView';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { authHref } from '@/lib/authRedirect';
import { clearStoredSession, readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

function LudoPlayInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const invite = search.get('invite');
  const spectate = search.get('mode') === 'spectate';
  const setSession = useSession((s) => s.setSession);
  const clearSession = useSession((s) => s.clearSession);
  const clearLudo = useSession((s) => s.clearLudo);
  const ludoId = params.id;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean | null>(null);
  const [booting, setBooting] = useState(false);
  const bootedFor = useRef<string | null>(null);

  useEffect(() => {
    clearLudo();
    bootedFor.current = null;
  }, [ludoId, clearLudo]);

  useEffect(() => {
    const stored = readStoredSession();
    setNeedsAuth(!stored);
  }, []);

  function bootSession() {
    const stored = readStoredSession();
    if (!stored) {
      setNeedsAuth(true);
      return;
    }
    const key = `${ludoId}:${stored.userId}`;
    if (bootedFor.current === key) return;
    bootedFor.current = key;

    setBooting(true);
    setReady(false);
    setError(null);
    try {
      setSession({
        userId: stored.userId,
        username: stored.username,
        name: stored.name,
        ticket: stored.ticket,
        sessionToken: stored.sessionToken,
      });
      setNeedsAuth(false);
      setReady(true);
    } catch (err) {
      bootedFor.current = null;
      clearStoredSession();
      clearSession();
      setNeedsAuth(true);
      setReady(false);
      setError(err instanceof Error ? err.message : 'Session expired');
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => {
    if (needsAuth !== false) return;
    bootSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ludoId, needsAuth]);

  if (needsAuth === null) {
    return <LoadingScreen label="Loading…" compact />;
  }

  if (needsAuth) {
    const returnTo = `/ludo/${ludoId}${invite ? `?invite=${invite}` : ''}${
      spectate ? `${invite ? '&' : '?'}mode=spectate` : ''
    }`;
    return (
      <div className="hud-panel mx-auto max-w-md space-y-4 p-6">
        <h2 className="font-display text-xl uppercase tracking-wider text-mushroom">
          Sign in to join
        </h2>
        <p className="text-sm text-cream/70">You need an account to enter this Ludo board.</p>
        {error ? (
          <StatusChip tone="danger" role="alert" className="text-xs">
            {error}
          </StatusChip>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button href={authHref('sign-in', returnTo)} className="min-h-11 text-center">
            Sign in
          </Button>
          <Button href={authHref('sign-up', returnTo)} variant="ghost" className="min-h-11 text-center">
            Create account
          </Button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <LoadingScreen compact label={booting ? 'Connecting…' : 'Loading board…'} />
    );
  }

  return <LudoView ludoId={ludoId} inviteCode={invite} initialSpectate={spectate} />;
}

export default function LudoPlayPage() {
  return (
    <Suspense fallback={<LoadingScreen compact label="Loading…" />}>
      <LudoPlayInner />
    </Suspense>
  );
}
