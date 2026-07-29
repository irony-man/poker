'use client';

import { SignInButton, SignUpButton, useAuth } from '@clerk/nextjs';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { TableView } from '@/components/TableView';
import { register } from '@/lib/api';
import { loadSavedAvatarId, saveAvatarId } from '@/lib/avatars';
import { useSession } from '@/lib/store';

function TablePageInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const invite = search.get('invite');
  const spectate = search.get('mode') === 'spectate';
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const setSession = useSession((s) => s.setSession);
  const clearTable = useSession((s) => s.clearTable);
  const sessionUserId = useSession((s) => s.userId);
  const tableId = params.id;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clearTable();
  }, [tableId, clearTable]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setReady(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function bootSession() {
      setReady(false);
      setError(null);

      const raw = localStorage.getItem('felt-session');
      let displayName = 'Player';
      if (raw) {
        try {
          const prev = JSON.parse(raw) as { name?: string; avatarId?: number };
          if (prev.name?.trim()) displayName = prev.name.trim();
        } catch {
          /* ignore */
        }
      }
      let avatarId = loadSavedAvatarId();
      if (raw) {
        try {
          const prev = JSON.parse(raw) as { avatarId?: number };
          if (typeof prev.avatarId === 'number') avatarId = prev.avatarId;
        } catch {
          /* ignore */
        }
      }

      const clerkToken = await getToken();
      if (!clerkToken) {
        if (!cancelled) setError('Sign in required');
        return;
      }

      // Always mint a fresh WS ticket on page load so refresh reconnects cleanly.
      const s = await register(displayName.slice(0, 32), avatarId, { clerkToken });
      if (cancelled) return;
      const session = { ...s, avatarId: s.avatarId ?? avatarId };
      setSession(session);
      localStorage.setItem('felt-session', JSON.stringify(session));
      saveAvatarId(session.avatarId);
      setReady(true);
    }

    void bootSession().catch((err) => {
      if (!cancelled) {
        setReady(false);
        setError(err instanceof Error ? err.message : 'Failed to connect');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, tableId, setSession, getToken]);

  if (!isLoaded) {
    return <p className="text-cream/60">Loading…</p>;
  }

  if (!isSignedIn) {
    return (
      <div className="hud-panel mx-auto max-w-md p-6 space-y-4 text-center">
        <h2 className="font-display text-xl text-gold uppercase tracking-wider">Sign in to play</h2>
        <p className="text-sm text-cream/60">
          Online tables require a Clerk account so seats stay tied to your identity.
        </p>
        <div className="flex justify-center gap-2">
          <SignInButton mode="modal">
            <button type="button" className="btn-ghost text-xs py-1.5 px-3">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button" className="btn-primary text-xs py-1.5 px-3">
              Sign up
            </button>
          </SignUpButton>
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="status-chip border-red-500/40 bg-red-950/50 text-red-300">{error}</p>;
  }

  if (!ready || !sessionUserId) {
    return <p className="text-cream/60">Connecting…</p>;
  }

  return (
    <div>
      {invite && (
        <p className="mb-2 text-xs text-cream/50">
          Invite code: <span className="text-gold font-mono">{invite}</span> — share with friends
        </p>
      )}
      <TableView tableId={tableId} initialSpectate={spectate} />
    </div>
  );
}

export default function TablePage() {
  return (
    <Suspense fallback={<p className="text-cream/60">Loading table…</p>}>
      <TablePageInner />
    </Suspense>
  );
}
