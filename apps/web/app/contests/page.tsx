'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContestsPanel } from '@/components/ContestsPanel';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { resolveContestInvite } from '@/lib/api';
import { useLobbySession } from '@/lib/useLobbySession';

export default function ContestsListPage() {
  const router = useRouter();
  const { authReady, signedIn, name, sessionToken, ensureSession } = useLobbySession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enterContestCode(code: string) {
    const session = await ensureSession();
    const { contest } = await resolveContestInvite(code);
    const { registerContest } = await import('@/lib/api');
    await registerContest(contest.id, { sessionToken: session.sessionToken });
    router.push(`/contest/${contest.id}`);
  }

  if (!authReady) {
    return <LoadingScreen label="Loading…" />;
  }

  return (
    <LobbyPageShell
      title="Host Contests"
      subtitle="Host a room for friends in a Wuffies freezeout or a fixed run of hands, set the max table size, invite people, and start when the seats look right."
      signedIn={signedIn}
      error={error}
    >
      <ContestsPanel
        disabled={busy}
        sessionToken={sessionToken}
        displayName={name}
        onEnsureSession={ensureSession}
        onOpenContest={(id) => router.push(`/contest/${id}`)}
        onJoinCode={async (code) => {
          setBusy(true);
          setError(null);
          try {
            await enterContestCode(code);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
          } finally {
            setBusy(false);
          }
        }}
      />
    </LobbyPageShell>
  );
}
