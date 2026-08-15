'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ContestsPanel } from '@/components/ContestsPanel';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { resolveContestInvite } from '@/lib/api';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

export default function ContestsListPage() {
  const router = useRouter();
  const { authReady, signedIn, name, sessionToken, ensureSession } = useLobbySession();
  const pageCopy = usePageCopy('contests');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enterContestCode(code: string) {
    const session = await ensureSession();
    const { contest } = await resolveContestInvite(code);
    if (contest.status === 'completed' || contest.status === 'cancelled') {
      // Details page shows standings / cancelled state — don't try to join a dead table.
      router.push(`/contest/${contest.id}`);
      return;
    }
    if (contest.status !== 'registering') {
      // Running — open lobby, do not re-register.
      router.push(`/contest/${contest.id}`);
      return;
    }
    const { registerContest } = await import('@/lib/api');
    await registerContest(contest.id, { sessionToken: session.sessionToken });
    router.push(`/contest/${contest.id}`);
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
      <ContestsPanel
        disabled={busy}
        sessionToken={sessionToken}
        displayName={name}
        imageSrc={pageCopy.image}
        imageAlt={pageCopy.imageAlt}
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
