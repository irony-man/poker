'use client';

import { useRouter } from 'next/navigation';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { QuickMatchPanel } from '@/components/QuickMatchPanel';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

export default function PublicTablesPage() {
  const router = useRouter();
  const { authReady, signedIn, ensureSession } = useLobbySession();
  const pageCopy = usePageCopy('public');

  async function startMatchmaking() {
    enterMobileFullscreen();
    await ensureSession();
  }

  function joinMatchedTable(tableId: string) {
    router.push(`/table/${tableId}`);
  }

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
