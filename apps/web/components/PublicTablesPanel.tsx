'use client';

import { useState } from 'react';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { STAKE_PRESETS } from '@poker/protocol';
import { useSession } from '@/lib/store';

import { formatMoneyLabel } from '@/lib/currency';

export function PublicTablesPanel({
  disabled,
  onJoin,
}: {
  disabled: boolean;
  onJoin: (tableId: string, inviteCode: string) => void | Promise<void>;
}) {
  const tables = useSession((s) => s.publicTables);
  const connection = useSession((s) => s.connection);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading = tables.length === 0 && connection !== 'open' && connection !== 'closed';
  const fetchError =
    connection === 'closed' && tables.length === 0 ? "Can't reach the server" : null;

  const byStake = new Map(tables.map((t) => [t.stakeId, t]));

  async function handleJoin(stakeId: string) {
    const table = byStake.get(stakeId);
    if (!table || disabled) return;
    if (table.seatedCount >= table.maxSeats) {
      setError('This table is full');
      return;
    }
    setBusy(stakeId);
    setError(null);
    try {
      await onJoin(table.tableId, table.inviteCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <LobbySplitCard imageSrc="/public-tables.png" imageAlt="Open public ring games ready to join">
      <p className="text-sm font-medium text-ink-strong-muted">
        Select the table size and sit down to play
      </p>

      {fetchError && (
        <p role="alert" className="status-chip border-danger/30 bg-danger/10 text-danger text-xs">
          {fetchError}
        </p>
      )}

      {loading && tables.length === 0 ? (
        <LoadingScreen compact label="Loading tables…" className="!py-4" />
      ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {STAKE_PRESETS.map((stake) => {
          const table = byStake.get(stake.id);
          const seated = table?.seatedCount ?? 0;
          const max = table?.maxSeats ?? 6;
          const full = !!table && seated >= max;
          const canJoin = !!table && !full && !fetchError;
          return (
            <div
              key={stake.id}
              className="flex flex-col gap-3 rounded-lg border border-sidebar/12 bg-mushroom/45 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold uppercase tracking-wider text-sidebar">
                    {stake.label}
                  </p>
                  <p className="text-xs font-medium text-ink-strong-muted">
                    Blinds {stake.smallBlind}/{stake.bigBlind}
                  </p>
                </div>
                <span className="text-[10px] font-display uppercase tracking-widest text-ink-strong-muted">
                  {loading ? '…' : `${seated}/${max}`}
                </span>
              </div>
              <p className="text-sm text-ink-strong-muted">
                Buy-in{' '}
                <span className="font-medium text-ink-strong">{formatMoneyLabel(stake.buyIn)}</span>
              </p>
              <button
                type="button"
                disabled={disabled || !canJoin || busy === stake.id}
                onClick={() => void handleJoin(stake.id)}
                className="btn-primary min-h-11 w-full text-xs"
              >
                {busy === stake.id
                  ? 'Joining…'
                  : loading
                    ? 'Loading…'
                    : full
                      ? 'Full'
                      : !table
                        ? 'Unavailable'
                        : 'Sit down'}
              </button>
            </div>
          );
        })}
      </div>
      )}

      {error && (
        <p role="alert" className="status-chip border-danger/30 bg-danger/10 text-danger text-xs">
          {error}
        </p>
      )}
    </LobbySplitCard>
  );
}
