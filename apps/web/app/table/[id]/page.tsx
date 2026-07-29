'use client';

import { SignInButton, SignUpButton, useAuth, useUser } from '@clerk/nextjs';
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
  const { user } = useUser();
  const setSession = useSession((s) => s.setSession);
  const sessionUserId = useSession((s) => s.userId);
  const sessionTicket = useSession((s) => s.ticket);
  const tableId = params.id;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setReady(false);
      setError(null);
      return;
    }

    // Reuse an existing session so we don't issue a new ticket and tear down the socket.
    if (sessionUserId && sessionTicket) {
      setReady(true);
      return;
    }

    const raw = localStorage.getItem('felt-session');
    if (raw) {
      try {
        const saved = JSON.parse(raw) as {
          userId?: string;
          name?: string;
          ticket?: string;
          avatarId?: number;
        };
        if (saved.userId && saved.ticket && saved.name) {
          setSession({
            userId: saved.userId,
            name: saved.name,
            ticket: saved.ticket,
          });
          setReady(true);
          return;
        }
      } catch {
        /* ignore */
      }
    }

    let cancelled = false;
    async function refreshSession() {
      setError(null);
      let displayName =
        user?.fullName?.trim() ||
        user?.username?.trim() ||
        user?.firstName?.trim() ||
        user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
        'Player';
      let avatarId = loadSavedAvatarId();
      if (raw) {
        try {
          const prev = JSON.parse(raw) as {
            name?: string;
            avatarId?: number;
          };
          if (prev.name?.trim()) displayName = prev.name.trim();
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

      const s = await register(displayName.slice(0, 32), avatarId, { clerkToken });
      if (cancelled) return;
      const session = { ...s, avatarId: s.avatarId ?? avatarId };
      setSession(session);
      localStorage.setItem('felt-session', JSON.stringify(session));
      saveAvatarId(session.avatarId);
      setReady(true);
    }

    void refreshSession().catch((err) => {
      if (!cancelled) {
        setReady(false);
        setError(err instanceof Error ? err.message : 'Failed to connect');
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- register only when no session; user read at call time
  }, [isLoaded, isSignedIn, sessionUserId, sessionTicket, setSession, getToken]);

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
