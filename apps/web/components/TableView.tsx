'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionControls } from './ActionControls';
import { ChatPanel } from './ChatPanel';
import { PlayingCard } from './PlayingCard';
import { SeatView } from './SeatView';
import { playTick } from '@/lib/audio';
import { usePokerSocket } from '@/lib/ws';
import { useSession } from '@/lib/store';

function seatAngles(maxSeats: number): number[] {
  // Start from bottom (90°) and distribute clockwise
  const start = 90;
  const step = 360 / maxSeats;
  return Array.from({ length: maxSeats }, (_, i) => start + i * step);
}

export function TableView({ tableId }: { tableId: string }) {
  const table = useSession((s) => s.table);
  const priv = useSession((s) => s.private);
  const userId = useSession((s) => s.userId);
  const connection = useSession((s) => s.connection);
  const lastError = useSession((s) => s.lastError);
  const setError = useSession((s) => s.setError);
  const { send } = usePokerSocket(tableId);
  const [buyInOpen, setBuyInOpen] = useState<number | null>(null);
  const prevVersion = useRef<number | null>(null);

  useEffect(() => {
    if (!table) return;
    if (prevVersion.current !== null && table.version !== prevVersion.current) {
      if (table.street === 'payout') playTick('win');
      else if (table.community.length > 0) playTick('deal');
      else playTick('action');
    }
    prevVersion.current = table.version;
  }, [table]);

  const angles = useMemo(
    () => seatAngles(table?.config.maxSeats ?? 6),
    [table?.config.maxSeats],
  );

  const mySeat = table?.players.find((p) => p.userId === userId)?.seat;

  const onAction = (action: string, amount?: number) => {
    if (!table) return;
    send({
      type: 'action',
      tableId,
      handId: table.handId,
      seq: table.actionSeq,
      action,
      amount,
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100dvh-5rem)]">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 text-sm text-cream/60">
          <div>
            Street: <span className="text-cream capitalize">{table?.street ?? '…'}</span>
            {table?.handId ? ` · #${table.handId}` : ''}
          </div>
          <div
            className={
              connection === 'open' ? 'text-emerald-400' : connection === 'connecting' ? 'text-amber-400' : 'text-red-400'
            }
          >
            {connection}
          </div>
        </div>

        {lastError && (
          <button
            type="button"
            onClick={() => setError(null)}
            className="mb-2 rounded-md bg-red-950/80 border border-red-800 px-3 py-1 text-sm text-left"
          >
            {lastError} (dismiss)
          </button>
        )}

        <div className="relative flex-1 felt-surface rounded-[40%] border-[10px] border-[#2a1c0e] shadow-felt min-h-[320px]">
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
            <div className="text-gold-light text-sm font-semibold tracking-wide">
              Pot {table?.pot ?? 0}
            </div>
            <div className="flex gap-1.5">
              {(table?.community ?? []).map((c) => (
                <PlayingCard key={c + table?.version} code={c} />
              ))}
              {table && table.community.length === 0 && table.street !== 'waiting' && (
                <span className="text-cream/40 text-xs">No board yet</span>
              )}
            </div>
          </div>

          {table?.players.map((p, i) => (
            <SeatView
              key={p.seat}
              player={p}
              angle={angles[i] ?? 90}
              isDealer={table.dealerButton === p.seat && table.street !== 'waiting'}
              isToAct={table.toAct === p.seat}
              isSelf={p.userId === userId}
              myCards={p.seat === mySeat ? priv?.holeCards ?? null : null}
              canManageBots={table.street === 'waiting' || table.street === 'payout'}
              onSit={() => setBuyInOpen(p.seat)}
              onAddBot={() =>
                send({
                  type: 'add_bot',
                  tableId,
                  seat: p.seat,
                  buyIn: table.config.minBuyIn,
                })
              }
              onRemoveBot={() => send({ type: 'remove_bot', tableId, seat: p.seat })}
            />
          ))}
        </div>

        <div className="mt-4 pb-[env(safe-area-inset-bottom)]">
          <ActionControls onAction={onAction} />
          <div className="mt-2 w-full max-w-xl mx-auto flex flex-wrap gap-2 justify-center">
            {table?.street === 'waiting' && mySeat !== undefined && (
              <button
                type="button"
                onClick={() => send({ type: 'start_hand', tableId })}
                className="rounded-lg border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10"
              >
                Start hand
              </button>
            )}
            {(table?.street === 'waiting' || table?.street === 'payout') &&
              table.players.some((p) => p.status === 'empty') && (
                <button
                  type="button"
                  onClick={() =>
                    send({ type: 'add_bot', tableId, buyIn: table.config.minBuyIn })
                  }
                  className="rounded-lg border border-cream/25 px-4 py-2 text-sm text-cream/80 hover:bg-cream/10"
                >
                  Add bot
                </button>
              )}
            {mySeat !== undefined && (table?.street === 'waiting' || table?.street === 'payout') && (
              <button
                type="button"
                onClick={() => {
                  const amount = table.config.minBuyIn;
                  send({ type: 'top_up', tableId, seat: mySeat, amount });
                }}
                className="rounded-lg px-4 py-2 text-xs text-cream/50 hover:text-cream"
              >
                Top up +{table.config.minBuyIn}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:w-72 shrink-0 relative">
        <ChatPanel
          onSend={(text) => send({ type: 'chat', tableId, text })}
          onEmoji={(emoji) => send({ type: 'emoji', tableId, emoji })}
        />
      </div>

      {buyInOpen !== null && table && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <form
            className="w-full max-w-sm rounded-2xl bg-[#161310] border border-cream/15 p-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const buyIn = Number(fd.get('buyIn'));
              send({ type: 'sit', tableId, seat: buyInOpen, buyIn });
              setBuyInOpen(null);
            }}
          >
            <h3 className="font-display text-xl">Sit seat {buyInOpen}</h3>
            <label className="block text-sm text-cream/70">
              Buy-in ({table.config.minBuyIn}–{table.config.maxBuyIn})
              <input
                name="buyIn"
                type="number"
                defaultValue={table.config.minBuyIn}
                min={table.config.minBuyIn}
                max={table.config.maxBuyIn}
                className="mt-1 w-full rounded-md bg-cream/5 border border-cream/15 px-3 py-2"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBuyInOpen(null)}
                className="flex-1 rounded-lg py-2 bg-cream/10"
              >
                Cancel
              </button>
              <button type="submit" className="flex-1 rounded-lg py-2 bg-gold text-ink font-semibold">
                Sit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
