'use client';

import { useState } from 'react';
import { LobbySplitCard } from '@/components/LobbySplitCard';
import { resolvePublicImage } from '@/lib/assets';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { STAKE_PRESETS } from '@poker/protocol';
import { useSession } from '@/lib/store';

import { formatMoneyLabel } from '@/lib/currency';

export function PublicTablesPanel({
  disabled,
  onJoin,
  imageSrc,
  imageAlt,
}: {
  disabled: boolean;
  onJoin: (tableId: string, inviteCode: string) => void | Promise<void>;
  imageSrc?: string;
  imageAlt?: string;
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
    <LobbySplitCard
      imageSrc={resolvePublicImage(imageSrc || '/public-tables.png')}
      imageAlt={imageAlt || 'Open public ring games ready to join'}
    >
      <p className="text-sm font-medium text-ink-strong-muted">
        Select the table size and sit down to play
      </p>

      {fetchError && (
        <StatusChip tone="danger" role="alert" className="text-xs">
          {fetchError}
        </StatusChip>
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
              className="surface-card flex flex-col gap-3 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold uppercase tracking-wider text-ink-strong">
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
              <Button
                type="button"
                disabled={disabled || !canJoin || busy === stake.id}
                onClick={() => void handleJoin(stake.id)}
                className="min-h-11 w-full text-xs"
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
              </Button>
            </div>
          );
        })}
      </div>
      )}

      {error && (
        <StatusChip tone="danger" role="alert" className="text-xs">
          {error}
        </StatusChip>
      )}
    </LobbySplitCard>
  );
}
