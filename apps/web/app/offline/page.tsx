'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { OfflineTableView } from '@/components/OfflineTableView';
import { LoadingScreen } from '@/components/LoadingScreen';
import type { TableConfig } from '@poker/engine';

function OfflineInner() {
  const search = useSearchParams();
  const name = (search.get('name') || 'Player').slice(0, 32);
  const seats = Math.min(9, Math.max(2, Number(search.get('seats')) || 6));

  const config: TableConfig = useMemo(
    () => ({
      maxSeats: seats,
      smallBlind: 5,
      bigBlind: 10,
      buyIn: 1000,
      turnTimeMs: 30000,
    }),
    [seats],
  );

  return <OfflineTableView config={config} playerName={name} />;
}

export default function OfflinePage() {
  return (
    <Suspense fallback={<LoadingScreen compact label="Loading offline table…" />}>
      <OfflineInner />
    </Suspense>
  );
}
