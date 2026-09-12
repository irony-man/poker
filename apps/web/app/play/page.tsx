'use client';

import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HostTableForm } from '@/components/HostTableForm';
import { JoinTableForm } from '@/components/JoinTableForm';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { Tabs } from '@/components/ui/Tabs';
import { resolvePublicImage } from '@/lib/assets';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

export type PlayMode = 'host' | 'join';

function parsePlayMode(value: string | null): PlayMode {
  return value === 'join' ? 'join' : 'host';
}

function PlayPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = parsePlayMode(searchParams.get('mode'));
  const { authReady, signedIn, sessionToken, ensureSession } = useLobbySession();
  const pageCopy = usePageCopy(mode);
  const [error, setError] = useState<string | null>(null);

  const setMode = useCallback(
    (next: PlayMode) => {
      setError(null);
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'host') params.delete('mode');
      else params.set('mode', next);
      const qs = params.toString();
      router.replace(qs ? `/play?${qs}` : '/play', { scroll: false });
    },
    [router, searchParams],
  );

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
      <LobbySplitCard
        imageSrc={resolvePublicImage(
          pageCopy.image ?? (mode === 'join' ? '/join-table.png' : '/host-table.png'),
        )}
        imageAlt={
          pageCopy.imageAlt ??
          (mode === 'join'
            ? 'Enter a table with an invite code'
            : 'Host a private table for your group')
        }
        alignTop
      >
        <Tabs
          label="Host or join"
          variant="segmented"
          idPrefix="play-mode"
          selected={mode}
          onSelect={setMode}
          options={[
            { id: 'host', label: 'Host', panelId: 'play-panel-host' },
            { id: 'join', label: 'Join', panelId: 'play-panel-join' },
          ]}
        />

        <div
          id={mode === 'host' ? 'play-panel-host' : 'play-panel-join'}
          role="tabpanel"
          aria-labelledby={`play-mode-${mode}`}
        >
          {mode === 'host' ? (
            <HostTableForm
              sessionToken={sessionToken}
              ensureSession={ensureSession}
              onError={setError}
            />
          ) : (
            <JoinTableForm ensureSession={ensureSession} onError={setError} />
          )}
        </div>
      </LobbySplitCard>
    </LobbyPageShell>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading…" />}>
      <PlayPageInner />
    </Suspense>
  );
}
