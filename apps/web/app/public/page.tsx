'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { PublicTablesPanel } from '@/components/PublicTablesPanel';
import { useLobbySession } from '@/lib/useLobbySession';

export default function PublicTablesPage() {
  const router = useRouter();
  const { authReady, signedIn, ensureSession } = useLobbySession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function joinPublicTable(tableId: string, inviteCode: string) {
    setBusy(true);
    setError(null);
    try {
      await ensureSession();
      router.push(`/table/${tableId}?invite=${inviteCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return <p className="pt-12 text-center text-ink-strong-muted">Loading…</p>;
  }

  return (
    <LobbyPageShell title="Public Tables" signedIn={signedIn} error={error} wide>
      <PublicTablesPanel disabled={busy} onJoin={joinPublicTable} />
    </LobbyPageShell>
  );
}
