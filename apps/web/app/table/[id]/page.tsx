'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { TableView } from '@/components/TableView';
import { register } from '@/lib/api';
import { useSession } from '@/lib/store';

function TablePageInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const invite = search.get('invite');
  const setSession = useSession((s) => s.setSession);
  const userId = useSession((s) => s.userId);
  const tableId = params.id;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function refreshSession() {
      const raw = localStorage.getItem('felt-session');
      let displayName = `Guest${Math.floor(Math.random() * 999)}`;
      if (raw) {
        try {
          const prev = JSON.parse(raw) as { name?: string };
          if (prev.name) displayName = prev.name;
        } catch {
          /* ignore */
        }
      }
      // Always re-register to get a fresh WS ticket (server may have restarted)
      const s = await register(displayName);
      if (cancelled) return;
      setSession(s);
      localStorage.setItem('felt-session', JSON.stringify(s));
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
      <TableView tableId={tableId} />
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
