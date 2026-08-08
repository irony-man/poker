'use client';

import { useRouter } from 'next/navigation';
import { FriendsPanel } from '@/components/FriendsPanel';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';

export default function FriendsPage() {
  const router = useRouter();
  const { authReady, signedIn } = useLobbySession();

  if (!authReady) {
    return <p className="pt-12 text-center text-ink-strong-muted">Loading…</p>;
  }

  return (
    <LobbyPageShell title="Friends" signedIn={signedIn} requireAuth>
      <FriendsPanel
        disabled={!signedIn}
        onNavigateTable={(tableId, inviteCode) => {
          enterMobileFullscreen();
          router.push(`/table/${tableId}?invite=${inviteCode}`);
        }}
        onNavigateContest={(contestId) => {
          enterMobileFullscreen();
          router.push(`/contest/${contestId}`);
        }}
      />
    </LobbyPageShell>
  );
}
