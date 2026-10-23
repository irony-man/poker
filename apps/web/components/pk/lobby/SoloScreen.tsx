'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  clearOfflineSession,
  loadOfflineSession,
  type OfflineSessionSnapshot,
} from '@/lib/offlineSession';
import { fetchPublicBotGroupsWithLabels, type PublicBotGroup } from '@/lib/api';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { useLobbySession } from '@/lib/useLobbySession';
import { PkBadge, PkPageHeader } from '../Bits';
import { PkButton } from '../Button';
import { PkSegmented, PkSelect } from '../Choice';
import { PkScope } from '../PkScope';

const SEATS = [2, 3, 4, 5, 6, 7, 8, 9];

export function PkSoloScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authReady, signedIn, name } = useLobbySession();
  const [seats, setSeats] = useState('6');
  const [groups, setGroups] = useState<PublicBotGroup[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [saved, setSaved] = useState<OfflineSessionSnapshot | null>(null);

  useEffect(() => {
    setSaved(loadOfflineSession());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicBotGroupsWithLabels().then(({ groups: next }) => {
      if (cancelled) return;
      setGroups(next);
      const fromUrl = searchParams.get('botGroup');
      setGroupId(fromUrl && next.some((group) => group.id === fromUrl) ? fromUrl : next.find((group) => group.isDefault)?.id ?? next[0]?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  function go(opts: { resume?: boolean; seats?: number; botGroup?: string | null; player?: string }) {
    enterMobileFullscreen();
    const params = new URLSearchParams({
      name: opts.player ?? (name.trim() || 'Player'),
      seats: String(opts.seats ?? Number(seats)),
    });
    const group = opts.botGroup !== undefined ? opts.botGroup : groupId;
    if (group) params.set('botGroup', group);
    if (opts.resume) params.set('resume', '1');
    router.push(`/offline?${params.toString()}`);
  }

  if (!authReady) {
    return (
      <PkScope>
        <p className="p-pk-6">Loading…</p>
      </PkScope>
    );
  }

  return (
    <PkScope>
      <div className="mx-auto w-full max-w-3xl px-pk-4 py-pk-6">
        <PkPageHeader
          title="Offline arena"
          subtitle="Practice against bots on this device. No account required."
          actions={signedIn ? <PkBadge>Signed in</PkBadge> : <PkBadge tone="free">Guest</PkBadge>}
        />
        <form
          className="flex flex-col gap-pk-5"
          onSubmit={(event) => {
            event.preventDefault();
            clearOfflineSession();
            go({});
          }}
        >
          <PkSegmented
            label="Seats"
            value={seats}
            onChange={setSeats}
            options={SEATS.map((seat) => ({ id: String(seat), label: String(seat) }))}
          />
          <p className="text-pk-caption text-muted">{Number(seats) - 1} bots</p>
          {groups.length > 0 ? (
            <PkSelect
              label="Bot pack"
              value={groupId ?? ''}
              onChange={setGroupId}
              options={groups.map((group) => ({ id: group.id, label: group.name }))}
            />
          ) : null}
          <PkButton type="submit">Deal me in</PkButton>
          {saved ? (
            <PkButton
              type="button"
              variant="secondary"
              onClick={() =>
                go({
                  resume: true,
                  seats: saved.seats,
                  botGroup: saved.botGroupId,
                  player: name.trim() || saved.playerName,
                })
              }
            >
              Resume
            </PkButton>
          ) : null}
        </form>
      </div>
    </PkScope>
  );
}
