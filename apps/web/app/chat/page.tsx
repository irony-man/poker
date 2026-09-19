'use client';

import { BotChatPanel } from '@/components/BotChatPanel';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

export default function ChatPage() {
  const { authReady, signedIn } = useLobbySession();
  const pageCopy = usePageCopy('chat');

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
      <BotChatPanel disabled={!signedIn} />
    </LobbyPageShell>
  );
}
