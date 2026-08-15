'use client';

import { useRouter } from 'next/navigation';
import { FriendsPanel } from '@/components/FriendsPanel';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

export default function FriendsPage() {
  const router = useRouter();
  const { authReady, signedIn } = useLobbySession();
  const pageCopy = usePageCopy('friends');

  if (!authReady) {
    return <LoadingScreen label="Loading…" />;
  }

  return (
    <LobbyPageShell
      title={pageCopy.title}
      subtitle={pageCopy.subtitle}
      signedIn={signedIn}
      requireAuth
    >
      <FriendsPanel
        disabled={!signedIn}
        imageSrc={pageCopy.image}
        imageAlt={pageCopy.imageAlt}
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
