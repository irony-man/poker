'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChoiceRow } from '@/components/ChoiceRow';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { fetchPublicBotGroups, type PublicBotGroup } from '@/lib/api';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { usePageCopy } from '@/lib/usePageCopy';

/** Full local range supported by the offline table. */
const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function SoloPage() {
  const router = useRouter();
  const { authReady, signedIn, name } = useLobbySession();
  const pageCopy = usePageCopy('solo');
  const [offlineSeats, setOfflineSeats] = useState(6);
  const [botGroups, setBotGroups] = useState<PublicBotGroup[]>([]);
  const [botGroupId, setBotGroupId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicBotGroups().then((groups) => {
      if (cancelled) return;
      setBotGroups(groups);
      setBotGroupId((cur) => {
        if (cur && groups.some((g) => g.id === cur)) return cur;
        return groups.find((g) => g.isDefault)?.id ?? groups[0]?.id ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!authReady) {
    return <LoadingScreen label="Loading…" />;
  }

  const bots = offlineSeats - 1;
  const displayName = name.trim() || 'Player';

  function onOffline(e: React.FormEvent) {
    e.preventDefault();
    enterMobileFullscreen();
    const params = new URLSearchParams({
      name: displayName,
      seats: String(offlineSeats),
    });
    if (botGroupId) params.set('botGroup', botGroupId);
    router.push(`/offline?${params.toString()}`);
  }

  return (
    <LobbyPageShell
      title={pageCopy.title}
      subtitle={pageCopy.subtitle}
      signedIn={signedIn}
      requireAuth={false}
    >
      <form onSubmit={onOffline}>
        <LobbySplitCard
          imageSrc="/home-offline.png"
          imageAlt="You versus a bot at a private practice table"
        >
          <div className="min-w-0 space-y-4">
            <div>
              <ChoiceRow
                label="Table size"
                name="offline-seats"
                selected={offlineSeats}
                options={SEAT_OPTIONS}
                onSelect={setOfflineSeats}
                format={(n) => String(n)}
              />
              <p className="field-help mt-2.5">
                {offlineSeats === 2
                  ? 'Heads-up — you vs 1 bot'
                  : `${offlineSeats}-handed · you + ${bots} bots`}
              </p>
            </div>
            {botGroups.length > 0 ? (
              <ChoiceRow
                label="Bot name pack"
                name="offline-bot-group"
                selected={botGroupId ?? botGroups[0]!.id}
                options={botGroups.map((g) => g.id)}
                onSelect={setBotGroupId}
                format={(id) => {
                  const g = botGroups.find((x) => x.id === id);
                  if (!g) return id;
                  return (
                    <span className="inline-flex flex-col items-start leading-tight">
                      <span>
                        {g.name}
                        {g.isDefault ? ' · default' : ''}
                      </span>
                      <span className="text-[10px] font-medium opacity-70">
                        {g.nameCount} name{g.nameCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  );
                }}
              />
            ) : null}
          </div>

          <div className="pt-0.5">
            <button type="submit" className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[14rem]">
              {offlineSeats === 2 ? 'Start heads-up' : `Start ${offlineSeats}-handed`}
            </button>
            <p className="field-help mt-2.5">
              Opens instantly · progress stays on this device
            </p>
          </div>
        </LobbySplitCard>
      </form>
    </LobbyPageShell>
  );
}
