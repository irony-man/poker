'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { OfflineTableView } from '@/components/OfflineTableView';
import { LoadingScreen } from '@/components/LoadingScreen';
import { fetchPublicBotGroups } from '@/lib/api';
import type { TableConfig } from '@poker/engine';

function OfflineInner() {
  const search = useSearchParams();
  const name = (search.get('name') || 'Player').slice(0, 32);
  const seats = Math.min(9, Math.max(2, Number(search.get('seats')) || 6));
  const botGroup = search.get('botGroup');
  const resume = search.get('resume') === '1';
  const [botNames, setBotNames] = useState<string[] | undefined>(undefined);
  const [botStyles, setBotStyles] = useState<{
    defaultPersonality: import('@/lib/api').BotPersonalityId | null;
    namePersonalities: Record<string, import('@/lib/api').BotPersonalityId>;
  } | null>(null);
  const [namesReady, setNamesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicBotGroups()
      .then((groups) => {
        if (cancelled) return;
        const g =
          (botGroup ? groups.find((x) => x.id === botGroup) : null) ??
          groups.find((x) => x.isDefault) ??
          groups[0];
        const names = g?.names?.filter(Boolean) ?? [];
        setBotNames(names.length > 0 ? names : undefined);
        setBotStyles(
          g
            ? {
                defaultPersonality: g.defaultPersonality ?? null,
                namePersonalities: { ...(g.namePersonalities ?? {}) },
              }
            : null,
        );
      })
      .finally(() => {
        if (!cancelled) setNamesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [botGroup]);

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

  if (!namesReady) {
    return <LoadingScreen compact label="Loading offline table…" />;
  }

  return (
    <OfflineTableView
      config={config}
      playerName={name}
      botNames={botNames}
      botStyles={botStyles}
      resume={resume}
      botGroupId={botGroup}
    />
  );
}

export default function OfflinePage() {
  return (
    <Suspense fallback={<LoadingScreen compact label="Loading offline table…" />}>
      <OfflineInner />
    </Suspense>
  );
}
