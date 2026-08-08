'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChoiceRow } from '@/components/ChoiceRow';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';

/** Full local range supported by the offline table. */
const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function SoloPage() {
  const router = useRouter();
  const { authReady, signedIn, name, setName } = useLobbySession();
  const [offlineSeats, setOfflineSeats] = useState(6);

  if (!authReady) {
    return <p className="pt-4 text-ink-strong-muted">Loading…</p>;
  }

  const bots = offlineSeats - 1;
  const displayName = name.trim() || 'Player';

  function onOffline(e: React.FormEvent) {
    e.preventDefault();
    enterMobileFullscreen();
    router.push(
      `/offline?name=${encodeURIComponent(displayName)}&seats=${offlineSeats}`,
    );
  }

  return (
    <LobbyPageShell
      title="Offline"
      subtitle="Train against bots on this device with the same Hold'em rules as live tables, no connection or lobby, and a seat count you choose before the first deal."
      signedIn={signedIn}
      requireAuth={false}
    >
      <form onSubmit={onOffline}>
        <LobbySplitCard
          imageSrc="/home-offline.png"
          imageAlt="You versus a bot at a private practice table"
        >
          <header className="min-w-0">
            <p className="font-display text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-strong/45">
              Practice · on device
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold leading-tight tracking-tight text-ink-strong sm:text-[1.7rem]">
              Train against bots
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-strong-muted">
              Same Hold&apos;em engine as live tables. No connection, no wait —
              deal when you&apos;re ready.
            </p>
          </header>

          <label className="block">
            <span className="hud-label">Your name at the table</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hud-input"
              maxLength={32}
              placeholder="Player"
              autoComplete="nickname"
              spellCheck={false}
            />
          </label>

          <div className="min-w-0">
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
