'use client';

import { useRouter } from 'next/navigation';
import { FriendsPanel } from '@/components/FriendsPanel';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { useLobbySession } from '@/lib/useLobbySession';

export default function FriendsPage() {
  const router = useRouter();
  const { authReady, signedIn } = useLobbySession();

  if (!authReady) {
    return <p className="pt-12 text-center text-ink-strong-muted">Loading…</p>;
  }

  return (
    <LobbyPageShell title="Friends" signedIn={signedIn} requireAuth wide>
      <FriendsPanel
        disabled={!signedIn}
        onNavigateTable={(tableId, inviteCode) => {
          router.push(`/table/${tableId}?invite=${inviteCode}`);
        }}
      />
    </LobbyPageShell>
  );
}
