'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChoiceRow } from '@/components/ChoiceRow';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { useLobbySession } from '@/lib/useLobbySession';

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function SoloPage() {
  const router = useRouter();
  const { authReady, signedIn, name, setName } = useLobbySession();
  const [offlineSeats, setOfflineSeats] = useState(6);

  if (!authReady) {
    return <p className="pt-4 text-ink-strong-muted">Loading…</p>;
  }

  function onOffline(e: React.FormEvent) {
    e.preventDefault();
    const display = encodeURIComponent(name.trim() || 'Player');
    router.push(`/offline?name=${display}&seats=${offlineSeats}`);
  }

  return (
    <LobbyPageShell title="Offline" signedIn={signedIn} requireAuth={false}>
      <form onSubmit={onOffline}>
        <LobbySplitCard imageSrc="/home-table.png" imageAlt="Solo practice table atmosphere">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider text-sidebar">
                Offline arena
              </h2>
              <p className="mt-1 text-sm font-medium text-ink-strong-muted">
                Local bots · no server · same engine
              </p>
            </div>
            <span className="status-chip shrink-0 border-sidebar/20 bg-sidebar/5 text-sidebar">
              Solo mode
            </span>
          </div>
          <label className="block">
            <span className="hud-label">Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="hud-input"
              maxLength={32}
            />
          </label>
          <ChoiceRow
            label="Seats"
            name="offline-seats"
            selected={offlineSeats}
            options={SEAT_OPTIONS}
            onSelect={setOfflineSeats}
            format={(n) => `${n} · ${n - 1} bots`}
          />
          <button type="submit" className="btn-primary min-h-11 w-full">
            Launch offline game
          </button>
        </LobbySplitCard>
      </form>
    </LobbyPageShell>
  );
}
