'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChoiceRow } from '@/components/ChoiceRow';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { useLobbySession } from '@/lib/useLobbySession';

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export default function SoloPage() {
  const router = useRouter();
  const { authReady, signedIn, name, setName } = useLobbySession();
  const [offlineSeats, setOfflineSeats] = useState(6);

  if (!authReady) {
    return <p className="pt-12 text-center text-ink-strong-muted">Loading…</p>;
  }

  function onOffline(e: React.FormEvent) {
    e.preventDefault();
    const display = encodeURIComponent(name.trim() || 'Player');
    router.push(`/offline?name=${display}&seats=${offlineSeats}`);
  }

  return (
    <LobbyPageShell title="Offline" signedIn={signedIn} requireAuth={false}>
      <form onSubmit={onOffline} className="hud-panel flex flex-col gap-3 p-4 sm:gap-3.5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-sidebar">
              Offline arena
            </h2>
            <p className="mt-1 text-sm text-ink-strong-muted font-medium">
              Local bots · no server · same engine
            </p>
          </div>
          <span className="status-chip border-sidebar/20 bg-sidebar/5 text-sidebar shrink-0">
            Solo mode
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <label className="min-w-0 block">
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
        </div>
        <button type="submit" className="btn-primary min-h-11 w-full sm:w-auto sm:self-start">
          Launch offline game
        </button>
      </form>
    </LobbyPageShell>
  );
}
