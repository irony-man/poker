'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionControls } from './ActionControls';
import { ChipStack, formatChips } from './ChipStack';
import { PlayingCard } from './PlayingCard';
import { SeatView } from './SeatView';
import { TableShell } from './TableShell';
import { TurnTimerBar } from './TurnTimer';
import { WinHandModal } from './WinHandModal';
import { playTick } from '@/lib/audio';
import { usePokerSocket } from '@/lib/ws';
import { useSession } from '@/lib/store';
import { seatAnglesForHero } from '@/lib/tableLayout';

export function TableView({
  tableId,
  initialSpectate = false,
}: {
  tableId: string;
  initialSpectate?: boolean;
}) {
  const table = useSession((s) => s.table);
  const priv = useSession((s) => s.private);
  const userId = useSession((s) => s.userId);
  const connection = useSession((s) => s.connection);
  const lastError = useSession((s) => s.lastError);
  const setError = useSession((s) => s.setError);
  const { send } = usePokerSocket(tableId);
  const [buyInOpen, setBuyInOpen] = useState<number | null>(null);
  const [botAddCount, setBotAddCount] = useState(3);
  const [spectating, setSpectating] = useState(initialSpectate);
  const [dismissedWinHandId, setDismissedWinHandId] = useState<string | null>(null);
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

  const mySeat = table?.players.find((p) => p.userId === userId)?.seat;
  const isSpectating = spectating && mySeat === undefined;

  const angles = useMemo(
    () => seatAnglesForHero(table?.config.maxSeats ?? 6, mySeat),
    [table?.config.maxSeats, mySeat],
  );

  useEffect(() => {
    if (mySeat !== undefined && spectating) setSpectating(false);
  }, [mySeat, spectating]);

  const winBySeat = useMemo(() => {
    const map = new Map<number, { amount: number; handName?: string }>();
    for (const w of table?.winners ?? []) {
      const prev = map.get(w.seat);
      const handName =
        w.handName && w.handName !== 'Uncontested' ? w.handName : prev?.handName;
      map.set(w.seat, {
        amount: (prev?.amount ?? 0) + w.amount,
        handName,
      });
    }
    return map;
  }, [table?.winners]);

  const handNameBySeat = useMemo(() => {
    const map = new Map<number, string>();
    for (const h of table?.showdownHands ?? []) map.set(h.seat, h.handName);
    for (const [seat, w] of winBySeat) {
      if (w.handName && !map.has(seat)) map.set(seat, w.handName);
    }
    return map;
  }, [table?.showdownHands, winBySeat]);

  /** Best-five card codes for any seat that won chips this hand. */
  const winningCards = useMemo(() => {
    const codes = new Set<string>();
    if (!table || (table.street !== 'payout' && table.street !== 'showdown')) return codes;
    const winnerSeats = new Set(table.winners.map((w) => w.seat));
    for (const h of table.showdownHands ?? []) {
      if (!winnerSeats.has(h.seat)) continue;
      for (const c of h.cards ?? []) codes.add(c);
    }
    return codes;
  }, [table]);
  const highlightMode = winningCards.size > 0;
  const showWinModal =
    table?.street === 'payout' &&
    (table.winners?.length ?? 0) > 0 &&
    table.handId !== dismissedWinHandId;
  const youWon = !!table?.winners.some((w) => table.players[w.seat]?.userId === userId);
  const canStartNext =
    !isSpectating &&
    mySeat !== undefined &&
    (table?.players.filter((p) => p.userId && p.stack > 0).length ?? 0) >= 2;

  const emptySeats = table?.players.filter((p) => p.status === 'empty').length ?? 0;
  const botSeats = table?.players.filter((p) => p.userId?.startsWith('bot:')).length ?? 0;

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

  const potTotal =
    (table?.pot ?? 0) ||
    (table?.sidePots?.reduce((s, p) => s + p.amount, 0) ?? 0);

  return (
    <TableShell
      onSend={(text) => send({ type: 'chat', tableId, text })}
      onEmoji={(emoji) => send({ type: 'emoji', tableId, emoji })}
    >
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 text-sm text-cream/60">
          <div className="flex items-center gap-2">
            <span className="status-chip border-cyan/25 bg-cyan/10 text-cyan capitalize">
              {table?.street ?? '…'}
            </span>
            {isSpectating && (
              <span className="status-chip border-gold/30 bg-gold/10 text-gold">Spectating</span>
            )}
            {table?.handId ? <span className="font-mono text-xs opacity-60">#{table.handId}</span> : null}
            {table && (
              <span className="text-xs text-cream/40">
                blinds {table.config.smallBlind}/{table.config.bigBlind}
              </span>
            )}
          </div>
          <div
            className={
              connection === 'open'
                ? 'status-chip border-felt-neon/30 bg-felt-neon/10 text-felt-neon'
                : connection === 'connecting'
                  ? 'status-chip border-amber-400/30 bg-amber-400/10 text-amber-300'
                  : 'status-chip border-red-500/40 bg-red-950/50 text-red-300'
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                connection === 'open'
                  ? 'bg-felt-neon animate-live-blink'
                  : connection === 'connecting'
                    ? 'bg-amber-300 animate-live-blink'
                    : 'bg-red-400'
              }`}
            />
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

        <div className="relative flex-1 felt-surface rounded-[42%] border-[12px] table-rim shadow-felt min-h-[340px] overflow-hidden">
          <div className="pointer-events-none absolute inset-6 rounded-[40%] border border-felt-neon/10 z-[1]" />

          <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-10">
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-gold/30 bg-ink/75 px-5 py-2.5 backdrop-blur-md shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
              <div className="text-[10px] font-display uppercase tracking-[0.22em] text-gold/75">Pot</div>
              <ChipStack amount={Math.max(potTotal, table?.pot ?? 0)} size="lg" />
              {(table?.sidePots?.length ?? 0) > 1 && (
                <div className="text-[10px] text-cream/45 font-display uppercase tracking-wider">
                  {table!.sidePots.length} pots
                </div>
              )}
            </div>
            <div className="flex gap-1.5 min-h-[5.25rem] items-center">
              {(table?.community ?? []).map((c) => (
                <PlayingCard
                  key={c + table?.version}
                  code={c}
                  highlight={highlightMode && winningCards.has(c)}
                  dimmed={highlightMode && !winningCards.has(c)}
                />
              ))}
              {table && table.community.length === 0 && table.street !== 'waiting' && (
                <span className="text-cream/40 text-xs font-display uppercase tracking-wider">Dealing…</span>
              )}
            </div>
          </div>

          {table?.players.map((p) => {
            const win = winBySeat.get(p.seat);
            return (
              <SeatView
                key={p.seat}
                player={p}
                angle={angles[p.seat] ?? 90}
                isDealer={table.dealerButton === p.seat && table.street !== 'waiting'}
                isToAct={table.toAct === p.seat}
                isSelf={p.userId === userId}
                isWinner={table.street === 'payout' && !!win}
                winAmount={win?.amount}
                handName={
                  table.street === 'payout' || table.street === 'showdown'
                    ? handNameBySeat.get(p.seat) ?? null
                    : null
                }
                myCards={p.seat === mySeat ? priv?.holeCards ?? null : null}
                winningCards={highlightMode ? winningCards : null}
                turnEndsAt={table.toAct === p.seat ? table.turnEndsAt : null}
                turnTotalMs={table.config.turnTimeMs}
                canManageBots={
                  !isSpectating && (table.street === 'waiting' || table.street === 'payout')
                }
                spectating={isSpectating}
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
            );
          })}
        </div>

        <div className="mt-4 pb-[env(safe-area-inset-bottom)]">
          {table?.turnEndsAt && table.toAct !== null && (
            <div className="mb-2">
              <TurnTimerBar
                endsAt={table.turnEndsAt}
                totalMs={table.config.turnTimeMs}
                isMyTurn={table.toAct === mySeat}
              />
            </div>
          )}
          <ActionControls onAction={onAction} spectating={isSpectating} />
          <div className="mt-2 w-full max-w-xl mx-auto flex flex-wrap gap-2 justify-center items-center">
            {isSpectating && (
              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2 mb-1">
                <p className="text-center text-xs text-cream/55">
                  Watching the table — chat and reactions still work
                </p>
                <button
                  type="button"
                  onClick={() => setSpectating(false)}
                  className="btn-ghost text-sm py-2"
                >
                  Sit and play
                </button>
              </div>
            )}
            {(table?.street === 'waiting' || table?.street === 'payout') &&
              mySeat !== undefined &&
              table.players.filter((p) => p.userId && p.stack > 0).length >= 2 && (
              <button
                type="button"
                onClick={() => send({ type: 'start_hand', tableId })}
                className="btn-ghost text-sm py-2"
              >
                Start hand
              </button>
            )}
            {!isSpectating &&
              (table?.street === 'waiting' || table?.street === 'payout') &&
              mySeat === undefined && (
              <p className="w-full text-center text-xs text-cream/50">
                Sit at an empty seat to play
                {table.players.filter((p) => p.userId && p.stack > 0).length >= 2
                  ? ' — then tap Start hand'
                  : ' (add bots or wait for friends)'}
                .
              </p>
            )}
            {!isSpectating &&
              (table?.street === 'waiting' || table?.street === 'payout') &&
              emptySeats > 0 && (
              <>
                <label className="flex items-center gap-2 text-xs text-cream/60">
                  Bots
                  <select
                    value={Math.min(botAddCount, emptySeats)}
                    onChange={(e) => setBotAddCount(Number(e.target.value))}
                    className="field-select w-auto py-1.5 text-sm"
                  >
                    {Array.from({ length: emptySeats }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    send({
                      type: 'add_bot',
                      tableId,
                      buyIn: table.config.minBuyIn,
                      count: Math.min(botAddCount, emptySeats),
                    })
                  }
                  className="rounded-lg border border-cream/25 px-4 py-2 text-sm text-cream/80 hover:bg-cream/10"
                >
                  Add bots
                </button>
                <button
                  type="button"
                  onClick={() =>
                    send({
                      type: 'add_bot',
                      tableId,
                      buyIn: table.config.minBuyIn,
                      count: emptySeats,
                    })
                  }
                  className="rounded-lg border border-cream/15 px-3 py-2 text-xs text-cream/60 hover:bg-cream/10"
                >
                  Fill table
                </button>
              </>
            )}
            {!isSpectating &&
              (table?.street === 'waiting' || table?.street === 'payout') &&
              botSeats > 0 && (
              <button
                type="button"
                onClick={() => send({ type: 'remove_all_bots', tableId })}
                className="rounded-lg px-3 py-2 text-xs text-cream/45 hover:text-red-300"
              >
                Remove all bots
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

          {showWinModal && table && (
            <WinHandModal
              youWon={youWon}
              canStartNext={canStartNext}
              winners={table.winners.map((w) => ({
                seat: w.seat,
                name: table.players[w.seat]?.name ?? `Seat ${w.seat}`,
                amount: w.amount,
                handName: w.handName,
                isSelf: table.players[w.seat]?.userId === userId,
              }))}
              onNextHand={() => {
                setDismissedWinHandId(table.handId);
                send({ type: 'start_hand', tableId });
              }}
              onDismiss={() => setDismissedWinHandId(table.handId)}
            />
          )}

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
    </TableShell>
  );
}
