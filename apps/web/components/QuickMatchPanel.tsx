'use client';

import { useEffect, useRef, useState } from 'react';
import { STAKE_PRESETS } from '@poker/protocol';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { resolvePublicImage } from '@/lib/assets';
import { formatMoneyLabel } from '@/lib/currency';
import { subscribeSocketMessages } from '@/lib/socketMessages';
import { useSession } from '@/lib/store';
import { sessionSocketSend } from '@/lib/ws';

type SearchStatus = { botFillAt: number; humansWaiting: number };

const DEFAULT_MAX_SEATS = 6;

/** Public poker: one card per stake; Sit down queues for a matchmade table at that stake. */
export function QuickMatchPanel({
  disabled,
  onStart,
  onFound,
  imageSrc,
  imageAlt,
}: {
  disabled: boolean;
  /** Ensure a signed-in session before queueing (throws to abort). */
  onStart: () => Promise<unknown>;
  onFound: (tableId: string) => void;
  imageSrc?: string;
  imageAlt?: string;
}) {
  const connection = useSession((s) => s.connection);
  const tables = useSession((s) => s.publicTables);
  const [searchingStake, setSearchingStake] = useState<string | null>(null);
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const searchingRef = useRef<string | null>(null);
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  useEffect(() => {
    searchingRef.current = searchingStake;
  }, [searchingStake]);

  useEffect(() => {
    return subscribeSocketMessages((raw) => {
      const msg = raw as { type?: string; [key: string]: unknown };
      if (!searchingRef.current) return;
      if (msg.type === 'matchmaking_status') {
        setStatus({
          botFillAt: Number(msg.botFillAt) || Date.now(),
          humansWaiting: Number(msg.humansWaiting) || 1,
        });
      } else if (msg.type === 'matchmaking_found') {
        searchingRef.current = null;
        setSearchingStake(null);
        setStatus(null);
        onFoundRef.current(String(msg.tableId));
      } else if (msg.type === 'matchmaking_cancelled') {
        searchingRef.current = null;
        setSearchingStake(null);
        setStatus(null);
      }
    });
  }, []);

  // (Re)queue whenever the socket is ready — the server drops queue entries on disconnect.
  useEffect(() => {
    if (!searchingStake || connection !== 'open') return;
    if (!sessionSocketSend({ type: 'matchmaking_join', stakeId: searchingStake })) {
      setError("Can't reach the server");
    }
  }, [searchingStake, connection]);

  useEffect(() => {
    if (!searchingStake) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [searchingStake]);

  useEffect(() => {
    return () => {
      if (searchingRef.current) sessionSocketSend({ type: 'matchmaking_cancel' });
    };
  }, []);

  async function sitDown(stakeId: string) {
    if (disabled || searchingStake) return;
    setError(null);
    try {
      await onStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      return;
    }
    setStatus(null);
    setSearchingStake(stakeId);
  }

  function cancel() {
    sessionSocketSend({ type: 'matchmaking_cancel' });
    searchingRef.current = null;
    setSearchingStake(null);
    setStatus(null);
  }

  /** Seats taken at the fullest open table of this stake (the one a new player lands on). */
  function seatsFor(stakeId: string): { seated: number; max: number } {
    let best: { seated: number; max: number } | null = null;
    for (const t of tables) {
      if (t.stakeId !== stakeId || t.seatedCount >= t.maxSeats) continue;
      if (!best || t.seatedCount > best.seated) best = { seated: t.seatedCount, max: t.maxSeats };
    }
    return best ?? { seated: 0, max: DEFAULT_MAX_SEATS };
  }

  const secondsLeft = status ? Math.max(0, Math.ceil((status.botFillAt - now) / 1000)) : null;
  const fetchError = connection === 'closed' ? "Can't reach the server" : null;

  return (
    <LobbySplitCard
      imageSrc={resolvePublicImage(imageSrc || '/public-tables.webp')}
      imageAlt={imageAlt || 'Open public ring games ready to join'}
    >
      <p className="text-sm font-medium text-muted">Select the table size and sit down to play</p>

      {fetchError && (
        <StatusChip tone="danger" role="alert" className="text-xs">
          {fetchError}
        </StatusChip>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {STAKE_PRESETS.map((stake) => {
          const { seated, max } = seatsFor(stake.id);
          const isSearching = searchingStake === stake.id;
          return (
            <div key={stake.id} className="surface-card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold uppercase tracking-wider text-primary">
                    {stake.label}
                  </p>
                  <p className="text-xs font-medium text-muted">
                    Blinds {stake.smallBlind}/{stake.bigBlind}
                  </p>
                </div>
                <span className="text-[10px] font-display uppercase tracking-widest text-muted">
                  {`${seated}/${max}`}
                </span>
              </div>
              {isSearching ? (
                <p role="status" aria-live="polite" className="text-sm text-muted tabular-nums">
                  {status ? `Finding a seat… ${secondsLeft}s` : 'Finding a seat…'}
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Buy-in{' '}
                  <span className="font-medium text-primary">{formatMoneyLabel(stake.buyIn)}</span>
                </p>
              )}
              {isSearching ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={cancel}
                  className="min-h-11 w-full text-xs"
                >
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={disabled || !!fetchError || searchingStake !== null}
                  onClick={() => void sitDown(stake.id)}
                  className="min-h-11 w-full text-xs"
                >
                  Sit down
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <StatusChip tone="danger" role="alert" className="text-xs">
          {error}
        </StatusChip>
      )}
    </LobbySplitCard>
  );
}
