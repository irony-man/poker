'use client';

import { useState } from 'react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';
import { AnalysisPanel } from './AnalysisPanel';

/** Analysis list, or one table when `tableId` is set. */
export function AnalysisScreen({
  tableId,
  since,
  requestCoach = false,
}: {
  tableId?: string;
  since?: number;
  requestCoach?: boolean;
}) {
  const { authReady, signedIn, sessionToken } = useLobbySession();
  const userId = useSession((s) => s.userId);
  const [tableTitle, setTableTitle] = useState<string | null>(null);

  if (!authReady) {
    return <LoadingScreen label="Loading…" />;
  }

  return (
    <LobbyPageShell
      breadcrumb={
        tableId ? (
          <Breadcrumb
            items={[
              { label: 'Analysis', href: '/analysis' },
              { label: tableTitle ?? 'Table' },
            ]}
          />
        ) : undefined
      }
      signedIn={signedIn}
      requireAuth
    >
      {signedIn && sessionToken && userId ? (
        <AnalysisPanel
          sessionToken={sessionToken}
          userId={userId}
          tableId={tableId}
          since={since}
          requestCoach={requestCoach}
          onTableTitle={setTableTitle}
        />
      ) : null}
    </LobbyPageShell>
  );
}
