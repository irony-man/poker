'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PublicTablesPanel } from '@/components/PublicTablesPanel';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

export default function PublicTablesPage() {
  const router = useRouter();
  const { authReady, signedIn, ensureSession } = useLobbySession();
  const pageCopy = usePageCopy('public');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function joinPublicTable(tableId: string, inviteCode: string) {
    enterMobileFullscreen();
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
    return <LoadingScreen label="Loading…" />;
  }

  return (
    <LobbyPageShell
      title={pageCopy.title}
      subtitle={pageCopy.subtitle}
      signedIn={signedIn}
      error={error}
    >
      <PublicTablesPanel disabled={busy} onJoin={joinPublicTable} />
    </LobbyPageShell>
  );
}
