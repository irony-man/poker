'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionControls } from './ActionControls';
import { FloatingActionDock } from './FloatingActionDock';
import { PlayingCard } from './PlayingCard';
import { DealerPotZone } from './DealerPotZone';
import { SeatView } from './SeatView';
import { TableShell } from './TableShell';
import { TopUpModal } from './TopUpModal';
import { VoiceCallBar } from './VoiceCallBar';
import { WinHandModal } from './WinHandModal';
import { playTick } from '@/lib/audio';
import { usePokerSocket } from '@/lib/ws';
import { useSession } from '@/lib/store';
import { useVoiceCall } from '@/hooks/useVoiceCall';
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
  const clearTable = useSession((s) => s.clearTable);
  const { send, leaveTable } = usePokerSocket(tableId);
  const voice = useVoiceCall(tableId, userId, send);
  const router = useRouter();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [botAddCount, setBotAddCount] = useState(3);
  const [spectating, setSpectating] = useState(initialSpectate);
  const [dismissedWinHandId, setDismissedWinHandId] = useState<string | null>(null);
  const prevVersion = useRef<number | null>(null);
  const autoSitSent = useRef(false);

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
  const myPlayer = mySeat !== undefined ? table?.players[mySeat] : undefined;
  const isSpectating = spectating && mySeat === undefined;
  const topUpHeadroom =
    table && myPlayer
      ? Math.max(0, table.config.maxBuyIn - myPlayer.stack)
      : 0;
  const canTopUp =
    mySeat !== undefined &&
    topUpHeadroom > 0 &&
    (table?.street === 'waiting' || table?.street === 'payout');

  const sitAtFirstOpenSeat = () => {
    if (!table || isSpectating) return false;
    const empty = table.players.find((p) => p.status === 'empty');
    if (!empty) return false;
    send({
      type: 'sit',
      tableId,
      seat: empty.seat,
      buyIn: table.config.maxBuyIn,
    });
    return true;
  };

  useEffect(() => {
    autoSitSent.current = false;
  }, [tableId]);

  useEffect(() => {
    if (!table || !userId || isSpectating || connection !== 'open') return;
    if (mySeat !== undefined || autoSitSent.current) return;
    const empty = table.players.find((p) => p.status === 'empty');
    if (!empty) return;
    autoSitSent.current = true;
    send({
      type: 'sit',
      tableId,
      seat: empty.seat,
      buyIn: table.config.maxBuyIn,
    });
  }, [table, userId, mySeat, isSpectating, connection, tableId, send]);

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
    myPlayer?.status !== 'sittingOut' &&
    (table?.players.filter((p) => p.userId && p.stack > 0 && p.status !== 'sittingOut').length ?? 0) >= 2;
  const betweenHands = table?.street === 'waiting' || table?.street === 'payout';
  const canSitOut = mySeat !== undefined && myPlayer?.status === 'seated' && betweenHands;
  const canSitIn = mySeat !== undefined && myPlayer?.status === 'sittingOut' && betweenHands;
  const playersInHand =
    table?.players.filter((p) => p.userId && p.stack > 0 && p.status !== 'sittingOut').length ?? 0;

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

  const leaveRoom = () => {
    voice.leaveVoice();
    leaveTable();
    clearTable();
    router.push('/');
  };

  const isMyTurn = table?.toAct === mySeat && !!priv?.legal?.types.length;
  const potTotal =
    (table?.pot ?? 0) ||
    (table?.sidePots?.reduce((s, p) => s + p.amount, 0) ?? 0);
  const dealerPlayer =
    table?.dealerButton != null ? table.players[table.dealerButton] : undefined;
  const showDealerZone = table?.street !== 'waiting' && table?.dealerButton != null;

  if (!table && (connection === 'connecting' || connection === 'open')) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-cream/60">Syncing table…</p>
      </div>
    );
  }

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
          <div className="flex items-center gap-2">
            <VoiceCallBar
              inVoice={voice.inVoice}
              state={voice.state}
              muted={voice.muted}
              peers={voice.peers}
              error={voice.error}
              onJoin={voice.joinVoice}
              onLeave={voice.leaveVoice}
              onToggleMute={voice.toggleMute}
            />
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
            <button type="button" onClick={leaveRoom} className="btn-ghost text-xs py-1.5 px-3">
              Leave
            </button>
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

        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 felt-surface rounded-[28%] border-[8px] table-rim shadow-felt overflow-hidden max-sm:rounded-[22%] max-sm:border-[7px] sm:rounded-[42%] sm:border-[12px]">
          <div className="pointer-events-none absolute inset-3 max-sm:inset-2 sm:inset-6 rounded-[26%] sm:rounded-[40%] border border-white/10 z-[1]" />

          {/* Dealer button + pot reserved at top of table */}
          <div className="absolute left-1/2 top-[12%] z-20 -translate-x-1/2 -translate-y-1/2">
            <DealerPotZone
              amount={Math.max(potTotal, table?.pot ?? 0)}
              sidePotCount={table?.sidePots?.length ?? 0}
              dealerName={dealerPlayer?.name}
              showDealer={showDealerZone}
            />
          </div>

          <div className="absolute left-1/2 top-[48%] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
            <div className="flex min-h-[5.25rem] items-center gap-1.5">
              {(table?.community ?? []).map((c, i) => (
                <PlayingCard
                  key={`${table?.handId ?? 'board'}-${c}`}
                  code={c}
                  dealDelay={i * 0.07}
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
                isToAct={table.toAct === p.seat}
                isSelf={p.userId === userId}
                isWinner={table.street === 'payout' && !!win}
                winAmount={win?.amount}
                handName={
                  table.street === 'payout' || table.street === 'showdown'
                    ? handNameBySeat.get(p.seat) ?? null
                    : null
                }
                handId={table.handId}
                myCards={p.seat === mySeat ? priv?.holeCards ?? null : null}
                winningCards={highlightMode ? winningCards : null}
                turnEndsAt={table.toAct === p.seat ? table.turnEndsAt : null}
                turnTotalMs={table.config.turnTimeMs}
                canManageBots={!isSpectating}
                spectating={isSpectating}
                onSit={() => {
                  if (!table || isSpectating) return;
                  send({
                    type: 'sit',
                    tableId,
                    seat: p.seat,
                    buyIn: table.config.maxBuyIn,
                  });
                }}
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

          <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border border-cream/15 bg-ink/85 px-2 py-1.5 shadow-lg backdrop-blur-md">
              {isSpectating && (
                <button
                  type="button"
                  onClick={() => {
                    setSpectating(false);
                    if (!sitAtFirstOpenSeat()) autoSitSent.current = false;
                    else autoSitSent.current = true;
                  }}
                  className="btn-ghost text-xs py-1.5"
                >
                  Sit and play
                </button>
              )}
              {(table?.street === 'waiting' || table?.street === 'payout') &&
                mySeat !== undefined &&
                myPlayer?.status !== 'sittingOut' &&
                playersInHand >= 2 && (
                <button
                  type="button"
                  onClick={() => send({ type: 'start_hand', tableId })}
                  className="btn-ghost text-xs py-1.5"
                >
                  Start hand
                </button>
              )}
              {!isSpectating && emptySeats > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      send({
                        type: 'add_bot',
                        tableId,
                        buyIn: table!.config.minBuyIn,
                        count: Math.min(Math.max(1, botAddCount), emptySeats),
                      })
                    }
                    className="rounded-full border border-cream/25 px-3 py-1.5 text-xs text-cream/80 hover:bg-cream/10"
                  >
                    + Bot
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      send({
                        type: 'add_bot',
                        tableId,
                        buyIn: table!.config.minBuyIn,
                        count: emptySeats,
                      })
                    }
                    className="rounded-full border border-cream/15 px-2.5 py-1.5 text-[10px] text-cream/55 hover:bg-cream/10"
                  >
                    Fill
                  </button>
                </>
              )}
              {!isSpectating && botSeats > 0 && (
                <button
                  type="button"
                  onClick={() => send({ type: 'remove_all_bots', tableId })}
                  className="rounded-full px-2.5 py-1.5 text-[10px] text-cream/45 hover:text-red-300"
                >
                  − Bots
                </button>
              )}
              {canSitOut && (
                <button
                  type="button"
                  onClick={() => send({ type: 'sit_out', tableId, seat: mySeat! })}
                  className="rounded-full border border-amber-400/30 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-400/10"
                >
                  Sit out
                </button>
              )}
              {canSitIn && (
                <button
                  type="button"
                  onClick={() => send({ type: 'sit_in', tableId, seat: mySeat! })}
                  className="rounded-full border border-felt-neon/30 bg-felt-neon/10 px-3 py-1.5 text-xs text-felt-neon hover:bg-felt-neon/20"
                >
                  Sit in
                </button>
              )}
              {canTopUp && (
                <button
                  type="button"
                  onClick={() => setTopUpOpen(true)}
                  className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs text-gold hover:bg-gold/20"
                >
                  Top up
                </button>
              )}
            </div>
          </div>
        </div>

        <FloatingActionDock expanded={!!isMyTurn} label="Actions">
          <ActionControls onAction={onAction} spectating={isSpectating} bare />
        </FloatingActionDock>
      </div>

          {showWinModal && table && (
            <WinHandModal
              youWon={youWon}
              canStartNext={canStartNext}
              winners={(() => {
                const bySeat = new Map<
                  number,
                  {
                    seat: number;
                    name: string;
                    amount: number;
                    handName?: string;
                    cards?: string[];
                    isSelf?: boolean;
                  }
                >();
                for (const w of table.winners) {
                  const prev = bySeat.get(w.seat);
                  const cards =
                    table.showdownHands?.find((h) => h.seat === w.seat)?.cards ?? prev?.cards;
                  bySeat.set(w.seat, {
                    seat: w.seat,
                    name: table.players[w.seat]?.name ?? `Seat ${w.seat}`,
                    amount: (prev?.amount ?? 0) + w.amount,
                    handName: w.handName ?? prev?.handName,
                    cards,
                    isSelf: table.players[w.seat]?.userId === userId,
                  });
                }
                return [...bySeat.values()];
              })()}
              onNextHand={() => {
                setDismissedWinHandId(table.handId);
                send({ type: 'start_hand', tableId });
              }}
              onDismiss={() => setDismissedWinHandId(table.handId)}
            />
          )}

          {topUpOpen && table && mySeat !== undefined && myPlayer && (
            <TopUpModal
              currentStack={myPlayer.stack}
              minBuyIn={table.config.minBuyIn}
              maxBuyIn={table.config.maxBuyIn}
              onDismiss={() => setTopUpOpen(false)}
              onConfirm={(amount) => {
                send({ type: 'top_up', tableId, seat: mySeat, amount });
                setTopUpOpen(false);
              }}
            />
          )}
    </TableShell>
  );
}
