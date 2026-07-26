'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { OfflineTableView } from '@/components/OfflineTableView';
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
      minBuyIn: 500,
      maxBuyIn: 1000,
      turnTimeMs: 30000,
    }),
    [seats],
  );

  return <OfflineTableView config={config} playerName={name} />;
}

export default function OfflinePage() {
  return (
    <Suspense fallback={<p className="text-cream/60">Loading offline table…</p>}>
      <OfflineInner />
    </Suspense>
  );
}
