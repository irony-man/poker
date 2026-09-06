'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearOfflineSession,
  loadOfflineSession,
  type OfflineSessionSnapshot,
} from '@/lib/offlineSession';
import { ChoiceRow } from '@/components/ChoiceRow';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { resolvePublicImage } from '@/lib/assets';
import { Button } from '@/components/ui/Button';
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
  const [savedSession, setSavedSession] = useState<OfflineSessionSnapshot | null>(null);

  useEffect(() => {
    setSavedSession(loadOfflineSession());
  }, []);

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

  function goOffline(opts: { resume?: boolean; seats?: number; botGroup?: string | null; name?: string }) {
    enterMobileFullscreen();
    const params = new URLSearchParams({
      name: opts.name ?? displayName,
      seats: String(opts.seats ?? offlineSeats),
    });
    const group = opts.botGroup !== undefined ? opts.botGroup : botGroupId;
    if (group) params.set('botGroup', group);
    if (opts.resume) params.set('resume', '1');
    router.push(`/offline?${params.toString()}`);
  }

  function onOffline(e: React.FormEvent) {
    e.preventDefault();
    clearOfflineSession();
    setSavedSession(null);
    goOffline({});
  }

  function onResume() {
    if (!savedSession) return;
    goOffline({
      resume: true,
      seats: savedSession.seats,
      botGroup: savedSession.botGroupId,
      name: displayName || savedSession.playerName,
    });
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
          imageSrc={resolvePublicImage(pageCopy.image ?? '/home-offline.png')}
          imageAlt={pageCopy.imageAlt ?? 'You versus a bot at a private practice table'}
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
                label="Level"
                name="offline-bot-group"
                selected={botGroupId ?? botGroups[0]!.id}
                options={botGroups.map((g) => g.id)}
                onSelect={setBotGroupId}
                format={(id) => {
                  const g = botGroups.find((x) => x.id === id);
                  if (!g) return id;
                  return (
                    <span className="inline-flex flex-col items-start leading-tight">
                      {g.name}
                    </span>
                  );
                }}
              />
            ) : null}
          </div>

          <div className="pt-0.5">
            {savedSession ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  className="min-h-11 w-full sm:w-auto sm:min-w-[14rem]"
                  onClick={onResume}
                >
                  Resume {savedSession.seats === 2 ? 'heads-up' : `${savedSession.seats}-handed`}
                </Button>
                <Button
                  type="submit"
                  variant="ghost"
                  className="min-h-11 w-full sm:w-auto"
                >
                  {offlineSeats === 2 ? 'New heads-up' : `New ${offlineSeats}-handed`}
                </Button>
              </div>
            ) : (
              <Button type="submit" className="min-h-11 w-full sm:w-auto sm:min-w-[14rem]">
                {offlineSeats === 2 ? 'Start heads-up' : `Start ${offlineSeats}-handed`}
              </Button>
            )}
            <p className="field-help mt-2.5">
              {savedSession
                ? 'Resume anytime on this device'
                : 'Opens instantly · progress stays on this device'}
            </p>
          </div>
        </LobbySplitCard>
      </form>
    </LobbyPageShell>
  );
}
