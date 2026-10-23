'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { QuickMatchPanel } from '@/components/QuickMatchPanel';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { PkPublicScreen } from '@/components/pk/lobby/PublicScreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';
import { usePokerV2 } from '@/lib/pokerV2';

function PublicTablesPage() {
  const router = useRouter();
  const pokerV2 = usePokerV2('public');
  const { authReady, signedIn, ensureSession } = useLobbySession();
  const pageCopy = usePageCopy('public');

  async function startMatchmaking() {
    enterMobileFullscreen();
    await ensureSession();
  }

  function joinMatchedTable(tableId: string) {
    router.push(`/table/${tableId}`);
  }

  if (pokerV2) return <PkPublicScreen />;

  if (!authReady) {
    return <LoadingScreen label="Loading…" />;
  }

  return (
    <LobbyPageShell title={pageCopy.title} subtitle={pageCopy.subtitle} signedIn={signedIn}>
      <QuickMatchPanel
        disabled={false}
        onStart={startMatchmaking}
        onFound={joinMatchedTable}
        imageSrc={pageCopy.image}
        imageAlt={pageCopy.imageAlt}
      />
    </LobbyPageShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading…" />}>
      <PublicTablesPage />
    </Suspense>
  );
}
