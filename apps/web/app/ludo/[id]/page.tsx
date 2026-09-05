'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { LudoView } from '@/components/ludo/LudoView';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { authHref } from '@/lib/authRedirect';
import { ensurePlaySession } from '@/lib/ensurePlaySession';
import { clearStoredSession, readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

function LudoPlayInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const invite = search.get('invite');
  const spectate = search.get('mode') === 'spectate';
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

  useEffect(() => {
    if (needsAuth !== false) return;
    const stored = readStoredSession();
    if (!stored) {
      setNeedsAuth(true);
      return;
    }
    const key = `${ludoId}:${stored.userId}`;
    if (bootedFor.current === key) return;

    let cancelled = false;
    setBooting(true);
    setReady(false);
    setError(null);
    void ensurePlaySession()
      .then(() => {
        if (cancelled) return;
        bootedFor.current = key;
        setNeedsAuth(false);
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        bootedFor.current = null;
        clearStoredSession();
        clearSession();
        setNeedsAuth(true);
        setReady(false);
        setError(err instanceof Error ? err.message : 'Session expired');
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ludoId, needsAuth, clearSession]);

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
