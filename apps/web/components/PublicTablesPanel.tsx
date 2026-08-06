'use client';

import { useCallback, useEffect, useState } from 'react';
import { listPublicTables, type PublicTableSummary } from '@/lib/api';
import { STAKE_PRESETS } from '@poker/protocol';

function formatMoney(n: number): string {
  return `$${n.toLocaleString()}`;
}

export function PublicTablesPanel({
  disabled,
  onJoin,
}: {
  disabled: boolean;
  onJoin: (tableId: string, inviteCode: string) => void | Promise<void>;
}) {
  const [tables, setTables] = useState<PublicTableSummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listPublicTables();
      setTables(data.tables);
      setFetchError(null);
    } catch {
      setFetchError("Can't reach the server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(id);
  }, [refresh]);

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
    <div className="hud-panel flex flex-col gap-4 p-5 sm:col-span-2 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider text-brass">
            Public tables
          </h2>
          <p className="mt-1 text-sm text-cream-muted font-medium">
            Pick your stakes · 6-max ring games
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="btn-ghost py-1.5 px-3 text-xs"
          >
            Refresh
          </button>
          <span className="status-chip border-patina/30 bg-patina/10 text-patina shrink-0">
            Quick join
          </span>
        </div>
      </div>

      {fetchError && (
        <p role="alert" className="status-chip border-red-500/40 bg-red-950/50 text-red-300 text-xs">
          {fetchError} — try Refresh
        </p>
      )}

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
              className="flex flex-col gap-3 rounded-lg border border-brass/15 bg-ink-raised/40 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold uppercase tracking-wider text-brass">
                    {stake.label}
                  </p>
                  <p className="mt-0.5 text-xs text-cream-muted font-medium">
                    Blinds {stake.smallBlind}/{stake.bigBlind}
                  </p>
                </div>
                <span className="text-[10px] font-display uppercase tracking-widest text-patina">
                  {loading ? '…' : `${seated}/${max}`}
                </span>
              </div>
              <p className="text-sm text-cream/80">
                Buy-in{' '}
                <span className="font-medium text-cream">{formatMoney(stake.buyIn)}</span>
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

      {error && (
        <p role="alert" className="status-chip border-red-500/40 bg-red-950/50 text-red-300 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
