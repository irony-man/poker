'use client';

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
  const setSession = useSession((s) => s.setSession);
  const userId = useSession((s) => s.userId);
  const tableId = params.id;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function refreshSession() {
      const raw = localStorage.getItem('felt-session');
      let displayName = `Guest${Math.floor(Math.random() * 999)}`;
      let avatarId = loadSavedAvatarId();
      let prevUserId: string | undefined;
      if (raw) {
        try {
          const prev = JSON.parse(raw) as {
            name?: string;
            avatarId?: number;
            userId?: string;
          };
          if (prev.name) displayName = prev.name;
          if (typeof prev.avatarId === 'number') avatarId = prev.avatarId;
          if (prev.userId) prevUserId = prev.userId;
        } catch {
          /* ignore */
        }
      }
      // Re-register with stable userId when possible (avoids name collisions).
      const s = await register(displayName, avatarId, prevUserId);
      if (cancelled) return;
      const session = { ...s, avatarId: s.avatarId ?? avatarId };
      setSession(session);
      localStorage.setItem('felt-session', JSON.stringify(session));
      saveAvatarId(session.avatarId);
      setReady(true);
    }
    void refreshSession().catch(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [setSession]);

  if (!ready || !userId) {
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
