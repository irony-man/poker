'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAKE_PRESETS } from '@poker/protocol';
import { formatMoneyLabel } from '@/lib/currency';
import { enterMobileFullscreen } from '@/lib/mobileFullscreen';
import { subscribeSocketMessages } from '@/lib/socketMessages';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';
import { sessionSocketSend } from '@/lib/ws';
import { PkBadge, PkPageHeader } from '../Bits';
import { PkButton } from '../Button';
import { PkGate } from '../Gate';
import { PkScope } from '../PkScope';

type SearchStatus = { botFillAt: number; humansWaiting: number };

export function PkPublicScreen() {
  const router = useRouter();
  const { authReady, signedIn, ensureSession } = useLobbySession();
  const connection = useSession((s) => s.connection);
  const tables = useSession((s) => s.publicTables);
  const [searching, setSearching] = useState<string | null>(null);
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<string | null>(null);
  const searchingRef = useRef<string | null>(null);
  searchingRef.current = searching;

  useEffect(() => {
    return subscribeSocketMessages((raw) => {
      const msg = raw as { type?: string; tableId?: unknown; botFillAt?: unknown; humansWaiting?: unknown };
      if (!searchingRef.current) return;
      if (msg.type === 'matchmaking_status') {
        setStatus({ botFillAt: Number(msg.botFillAt) || Date.now(), humansWaiting: Number(msg.humansWaiting) || 1 });
      } else if (msg.type === 'matchmaking_found') {
        searchingRef.current = null;
        setSearching(null);
        router.push(`/table/${String(msg.tableId)}`);
      } else if (msg.type === 'matchmaking_cancelled') {
        setSearching(null);
        setStatus(null);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!searching || connection !== 'open') return;
    sessionSocketSend({ type: 'matchmaking_join', stakeId: searching });
  }, [searching, connection]);

  useEffect(() => {
    return () => {
      if (searchingRef.current) sessionSocketSend({ type: 'matchmaking_cancel' });
    };
  }, []);

  async function sit(stakeId: string) {
    if (!signedIn) {
      setGate(`/public`);
      return;
    }
    enterMobileFullscreen();
    setError(null);
    try {
      await ensureSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      return;
    }
    setSearching(stakeId);
  }

  function watch(tableId: string) {
    router.push(`/table/${tableId}?mode=spectate`);
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
      <div className="mx-auto w-full max-w-4xl px-pk-4 py-pk-6">
        <PkPageHeader title="Public tables" subtitle="Sit down for a quick match, or watch a table that already has seats." />
        <div className="grid gap-pk-3 sm:grid-cols-2">
          {STAKE_PRESETS.map((stake) => {
            const open = tables.filter((table) => table.stakeId === stake.id && table.seatedCount < table.maxSeats);
            const best = open.sort((a, b) => b.seatedCount - a.seatedCount)[0];
            return (
              <article key={stake.id} className="rounded-pk-lg border border-subtle/30 bg-panel p-pk-4 shadow-pk-sm">
                <div className="flex items-start justify-between">
                  <h2 className="font-pk-display text-pk-h4">{stake.label}</h2>
                  <PkBadge tone="free">{best ? `${best.maxSeats - best.seatedCount} seats free` : 'Open'}</PkBadge>
                </div>
                <p className="mt-pk-2 text-pk-caption tabular-nums text-muted">
                  Blinds {stake.smallBlind}/{stake.bigBlind} · {formatMoneyLabel(stake.buyIn)}
                </p>
                {searching === stake.id ? (
                  <p role="status" className="mt-pk-3 text-pk-body-md">
                    {status ? 'Finding a seat…' : 'Finding a seat…'}
                  </p>
                ) : null}
                <div className="mt-pk-4 flex gap-pk-2">
                  {searching === stake.id ? (
                    <PkButton
                      variant="ghost"
                      onClick={() => {
                        sessionSocketSend({ type: 'matchmaking_cancel' });
                        setSearching(null);
                      }}
                    >
                      Cancel
                    </PkButton>
                  ) : (
                    <PkButton disabled={searching != null} onClick={() => void sit(stake.id)}>
                      {signedIn ? 'Sit down' : 'Sign in to sit'}
                    </PkButton>
                  )}
                  {best ? (
                    <PkButton variant="secondary" onClick={() => watch(best.tableId)}>
                      Watch
                    </PkButton>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        {error ? (
          <p role="alert" className="mt-pk-4 text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <PkGate
        open={gate != null}
        title="Sign in to sit"
        body="Watching is open once you’re at the table. Sitting down needs an account."
        next={gate ?? '/public'}
        onClose={() => setGate(null)}
      />
    </PkScope>
  );
}
