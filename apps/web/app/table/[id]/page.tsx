'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
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

  useEffect(() => {
    const raw = localStorage.getItem('felt-session');
    if (raw) {
      try {
        setSession(JSON.parse(raw));
        return;
      } catch {
        /* fall through */
      }
    }
    void register(`Guest${Math.floor(Math.random() * 999)}`).then((s) => {
      setSession(s);
      localStorage.setItem('felt-session', JSON.stringify(s));
    });
  }, [setSession]);

  if (!userId) {
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
