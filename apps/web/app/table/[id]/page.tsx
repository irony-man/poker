'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { TableView } from '@/components/TableView';
import { clearStoredSession, readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';

function TablePageInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const invite = search.get('invite');
  const spectate = search.get('mode') === 'spectate';
  const setSession = useSession((s) => s.setSession);
  const clearSession = useSession((s) => s.clearSession);
  const clearTable = useSession((s) => s.clearTable);
  const tableId = params.id;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean | null>(null);
  const [booting, setBooting] = useState(false);
  const bootedFor = useRef<string | null>(null);

  useEffect(() => {
    clearTable();
    bootedFor.current = null;
  }, [tableId, clearTable]);

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
    const key = `${tableId}:${stored.userId}`;
    if (bootedFor.current === key) return;
    bootedFor.current = key;

    setBooting(true);
    setReady(false);
    setError(null);
    try {
      // Stored ticket is multi-use with a long TTL — no /api/ticket on every table open.
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
  }, [tableId, needsAuth]);

  if (needsAuth === null) {
    return <p className="text-ink-strong-muted">Loading…</p>;
  }

  if (needsAuth) {
    const next = encodeURIComponent(
      `/table/${tableId}${invite ? `?invite=${invite}` : ''}${spectate ? `${invite ? '&' : '?'}mode=spectate` : ''}`,
    );
    return (
      <div className="hud-panel mx-auto max-w-md space-y-4 p-6">
        <h2 className="font-display text-xl uppercase tracking-wider text-mushroom">Sign in to join</h2>
        <p className="text-sm text-cream/70">You need an account to enter this table.</p>
        {error && (
          <p role="alert" className="status-chip border-red-500/40 bg-red-950/50 text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Link href={`/sign-in?next=${next}`} className="btn-primary min-h-11 text-center">
            Sign in
          </Link>
          <Link href={`/sign-up`} className="btn-ghost min-h-11 text-center">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <p className="text-ink-strong-muted">{booting ? 'Connecting…' : 'Loading table…'}</p>
    );
  }

  return <TableView tableId={tableId} inviteCode={invite} initialSpectate={spectate} />;
}

export default function TablePage() {
  return (
    <Suspense fallback={<p className="text-ink-strong-muted">Loading…</p>}>
      <TablePageInner />
    </Suspense>
  );
}
