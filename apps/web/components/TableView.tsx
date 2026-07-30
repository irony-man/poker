'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionControls } from './ActionControls';
import { CommunityBoard } from './CommunityBoard';
import { FloatingActionDock } from './FloatingActionDock';
import { DealerPotZone } from './DealerPotZone';
import { SeatView } from './SeatView';
import { ShareTableLink } from './ShareTableLink';
import { TableOverflowMenu, type OverflowItem } from './TableOverflowMenu';
import { TableShell } from './TableShell';
import { TopUpModal } from './TopUpModal';
import { VoiceCallBar } from './VoiceCallBar';
import { WinHandModal } from './WinHandModal';
import { playTick } from '@/lib/audio';
import { buildTableJoinLink, buildTableJoinShareText } from '@/lib/tableLink';
import { usePokerSocket } from '@/lib/ws';
import { useSession } from '@/lib/store';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { seatAnglesForHero, useIsLandscapePhone, useIsNarrow } from '@/lib/tableLayout';

export function TableView({
  tableId,
  inviteCode,
  initialSpectate = false,
}: {
  tableId: string;
  inviteCode?: string | null;
  initialSpectate?: boolean;
}) {
  const table = useSession((s) => s.table);
  const priv = useSession((s) => s.private);
  const userId = useSession((s) => s.userId);
  const connection = useSession((s) => s.connection);
  const lastError = useSession((s) => s.lastError);
  const lastErrorCode = useSession((s) => s.lastErrorCode);
  const setError = useSession((s) => s.setError);
  const clearTable = useSession((s) => s.clearTable);
  const { send, leaveTable } = usePokerSocket(tableId, { spectate: initialSpectate });
  const voice = useVoiceCall(tableId, userId, send);
  const router = useRouter();
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const botAddCount = 3;
  const [spectating, setSpectating] = useState(initialSpectate);
  const [dismissedWinHandId, setDismissedWinHandId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const prevVersion = useRef<number | null>(null);
  const autoSitSent = useRef(false);

  useEffect(() => {
    if (lastErrorCode !== 'not_found') return;
    voice.leaveVoice();
    leaveTable();
    clearTable();
    setError(null);
    router.replace('/');
  }, [lastErrorCode, voice.leaveVoice, leaveTable, clearTable, setError, router]);

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
  const canTopUp =
    mySeat !== undefined &&
    !!myPlayer &&
    myPlayer.stack === 0 &&
    (table?.street === 'waiting' || table?.street === 'payout');

  const sitAtFirstOpenSeat = () => {
    if (!table || isSpectating) return false;
    const empty = table.players.find((p) => p.status === 'empty');
    if (!empty) return false;
    send({
      type: 'sit',
      tableId,
      seat: empty.seat,
      buyIn: table.config.buyIn,
    });
    return true;
  };

  useEffect(() => {
    autoSitSent.current = false;
  }, [tableId]);

  // Reset so a reconnect can sit again if the first attempt was dropped.
  useEffect(() => {
    if (connection !== 'open') autoSitSent.current = false;
  }, [connection]);

  // Client fallback — server also auto-sits on join_table (unless spectating).
  useEffect(() => {
    if (!table || !userId || isSpectating || connection !== 'open') return;
    if (mySeat !== undefined) return;
    if (autoSitSent.current) return;
    const empty = table.players.find((p) => p.status === 'empty');
    if (!empty || !table.config.buyIn) return;
    const ok = send({
      type: 'sit',
      tableId,
      seat: empty.seat,
      buyIn: table.config.buyIn,
    });
    if (ok) autoSitSent.current = true;
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
  const canSitOut =
    mySeat !== undefined &&
    betweenHands &&
    myPlayer &&
    myPlayer.status !== 'empty' &&
    myPlayer.status !== 'sittingOut';
  const canSitIn = mySeat !== undefined && myPlayer?.status === 'sittingOut' && betweenHands;
  const playersInHand =
    table?.players.filter((p) => p.userId && p.stack > 0 && p.status !== 'sittingOut').length ?? 0;

  const emptySeats = table?.players.filter((p) => p.status === 'empty').length ?? 0;
  const botSeats = table?.players.filter((p) => p.userId?.startsWith('bot:')).length ?? 0;
  const canStartHand =
    betweenHands &&
    mySeat !== undefined &&
    myPlayer?.status !== 'sittingOut' &&
    playersInHand >= 2;
  /** Desktop keeps the full pill row; mobile only shows a Start CTA between hands. */
  const showDesktopTools =
    !narrow &&
    (isSpectating ||
      canSitOut ||
      canSitIn ||
      canTopUp ||
      (!isSpectating && emptySeats > 0) ||
      (!isSpectating && botSeats > 0) ||
      canStartHand);
  const showMobileStartCta = narrow && (canStartHand || isSpectating);

  const shareInvite = async () => {
    if (!inviteCode) return;
    const link = buildTableJoinLink(tableId, inviteCode);
    const text = buildTableJoinShareText(tableId, inviteCode);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Join my poker table', text, url: link });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

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

  if (!table && lastErrorCode === 'not_found') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-cream/60">Table not found — returning home…</p>
      </div>
    );
  }

  if (!table && (connection === 'connecting' || connection === 'open')) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-cream/60">Syncing table…</p>
      </div>
    );
  }

  const mobileOverflowItems: OverflowItem[] = [];
  if (narrow) {
    if (inviteCode) {
      mobileOverflowItems.push({
        id: 'invite',
        label: 'Invite / share',
        onClick: () => void shareInvite(),
        tone: 'gold',
      });
    }
    if (!voice.inVoice) {
      mobileOverflowItems.push({
        id: 'voice',
        label: voice.state === 'joining' ? 'Joining voice…' : 'Join voice',
        onClick: () => void voice.joinVoice(),
        disabled: voice.state === 'joining',
      });
    } else {
      mobileOverflowItems.push(
        {
          id: 'mute',
          label: voice.muted ? 'Unmute mic' : 'Mute mic',
          onClick: () => voice.toggleMute(),
        },
        {
          id: 'leave-av',
          label: 'Leave call',
          onClick: () => voice.leaveVoice(),
          tone: 'danger',
        },
      );
    }
    mobileOverflowItems.push({
      id: 'chat',
      label: 'Chat',
      onClick: () => setChatOpen(true),
      tone: 'accent',
    });
    if (!isSpectating && emptySeats > 0) {
      mobileOverflowItems.push(
        {
          id: 'add-bot',
          label: '+ Bot',
          onClick: () =>
            send({
              type: 'add_bot',
              tableId,
              buyIn: table!.config.buyIn,
              count: Math.min(Math.max(1, botAddCount), emptySeats),
            }),
        },
        {
          id: 'fill',
          label: 'Fill empty seats',
          onClick: () =>
            send({
              type: 'add_bot',
              tableId,
              buyIn: table!.config.buyIn,
              count: emptySeats,
            }),
        },
      );
    }
    if (!isSpectating && botSeats > 0) {
      mobileOverflowItems.push({
        id: 'remove-bots',
        label: 'Remove bots',
        onClick: () => send({ type: 'remove_all_bots', tableId }),
        tone: 'danger',
      });
    }
    if (canSitOut) {
      mobileOverflowItems.push({
        id: 'sit-out',
        label: 'Sit out',
        onClick: () => send({ type: 'sit_out', tableId, seat: mySeat! }),
      });
    }
    if (canSitIn) {
      mobileOverflowItems.push({
        id: 'sit-in',
        label: 'Sit in',
        onClick: () => send({ type: 'sit_in', tableId, seat: mySeat! }),
        tone: 'accent',
      });
    }
    if (canTopUp) {
      mobileOverflowItems.push({
        id: 'top-up',
        label: 'Top up',
        onClick: () => setTopUpOpen(true),
        tone: 'gold',
      });
    }
    mobileOverflowItems.push({
      id: 'leave',
      label: 'Leave table',
      onClick: leaveRoom,
      tone: 'danger',
    });
  }

  return (
    <TableShell
      onSend={(text) => send({ type: 'chat', tableId, text })}
      onEmoji={(emoji) => send({ type: 'emoji', tableId, emoji })}
      chatOpen={chatOpen}
      onChatOpenChange={setChatOpen}
    >
      <div className="flex flex-1 flex-col min-h-0">
        {/* Mobile: street · blinds · overflow | Desktop: full chrome */}
        <div className="mb-1 flex shrink-0 items-center justify-between gap-2 text-sm text-cream/60 sm:mb-2">
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <span className="status-chip shrink-0 border-cyan/25 bg-cyan/10 text-cyan capitalize max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[10px]">
              {table?.street ?? '…'}
            </span>
            {isSpectating && (
              <span className="status-chip shrink-0 border-gold/30 bg-gold/10 text-gold max-sm:text-[10px]">
                Spec
              </span>
            )}
            {table && (
              <span className="truncate text-[10px] text-cream/40 sm:text-xs">
                {table.config.smallBlind}/{table.config.bigBlind}
              </span>
            )}
            {table?.handId ? (
              <span className="hidden font-mono text-[10px] opacity-50 sm:inline">#{table.handId}</span>
            ) : null}
          </div>

          {narrow ? (
            <TableOverflowMenu
              items={mobileOverflowItems}
              footer={
                <div className="flex items-center gap-2 text-[10px] text-cream/45">
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
              }
            />
          ) : (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
              {inviteCode && <ShareTableLink tableId={tableId} inviteCode={inviteCode} />}
              <VoiceCallBar
                inVoice={voice.inVoice}
                state={voice.state}
                muted={voice.muted}
                peers={voice.peers}
                error={voice.error}
                onJoinVoice={voice.joinVoice}
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
                title={connection}
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
                <span>{connection}</span>
              </div>
              <button type="button" onClick={leaveRoom} className="btn-ghost text-xs py-1.5 px-3">
                Leave
              </button>
            </div>
          )}
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

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 min-w-0 flex-1">
          <div
            className={`absolute inset-0 felt-surface table-rim shadow-felt overflow-hidden ${
              landscape
                ? 'rounded-[28%] border-[6px]'
                : narrow
                  ? 'rounded-[18%] border-[5px]'
                  : 'rounded-[42%] border-[12px]'
            }`}
          >
          <div
            className={`pointer-events-none absolute z-[1] border border-white/10 ${
              landscape
                ? 'inset-2 rounded-[24%]'
                : narrow
                  ? 'inset-1.5 rounded-[16%]'
                  : 'inset-6 rounded-[40%]'
            }`}
          />

          <div
            className={`absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 ${
              landscape ? 'top-[12%] scale-90' : narrow ? 'top-[7%] scale-90' : 'top-[10%]'
            }`}
          >
            <DealerPotZone
              amount={Math.max(potTotal, table?.pot ?? 0)}
              sidePotCount={table?.sidePots?.length ?? 0}
              dealerName={narrow ? undefined : dealerPlayer?.name}
              showDealer={showDealerZone}
            />
          </div>

          <div
            className={`absolute left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${
              landscape ? 'top-[44%]' : narrow ? 'top-[38%]' : 'top-[42%]'
            }`}
          >
            <CommunityBoard
              cards={table?.community ?? []}
              handId={table?.handId}
              cardSize={narrow ? 'sm' : 'md'}
              compact={narrow}
              highlightMode={highlightMode}
              winningCards={winningCards}
              dealing={!!table && table.street !== 'waiting'}
            />
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
                compact={narrow}
                landscape={landscape}
                onSit={() => {
                  if (!table || isSpectating) return;
                  send({
                    type: 'sit',
                    tableId,
                    seat: p.seat,
                    buyIn: table.config.buyIn,
                  });
                }}
                onAddBot={() =>
                  send({
                    type: 'add_bot',
                    tableId,
                    seat: p.seat,
                    buyIn: table.config.buyIn,
                  })
                }
                onRemoveBot={() => send({ type: 'remove_bot', tableId, seat: p.seat })}
              />
            );
          })}
          </div>
          </div>

          {showMobileStartCta && (
            <div className="relative z-30 flex shrink-0 justify-center px-1 pb-0.5 pt-1">
              {isSpectating ? (
                <button
                  type="button"
                  onClick={() => {
                    setSpectating(false);
                    if (!sitAtFirstOpenSeat()) autoSitSent.current = false;
                    else autoSitSent.current = true;
                  }}
                  className="btn-ghost min-h-10 px-4 text-[11px] font-display font-bold uppercase tracking-wide"
                >
                  Sit & play
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => send({ type: 'start_hand', tableId })}
                  className="btn-primary min-h-10 px-5 text-[11px] font-display font-bold uppercase tracking-wide"
                >
                  Start hand
                </button>
              )}
            </div>
          )}

          {showDesktopTools && (
          <div className="relative z-30 flex shrink-0 justify-center px-2 pb-1 pt-2">
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
              {canStartHand && (
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
                        buyIn: table!.config.buyIn,
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
                        buyIn: table!.config.buyIn,
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
          )}
        </div>

        <FloatingActionDock expanded={!!isMyTurn} label="Actions">
          <ActionControls onAction={onAction} spectating={isSpectating} bare />
        </FloatingActionDock>
      </div>

          {showWinModal && table && (
            <WinHandModal
              youWon={youWon}
              canStartNext={canStartNext}
              canTopUp={canTopUp}
              canSitOut={canSitOut}
              canSitIn={canSitIn}
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
              onTopUp={() => setTopUpOpen(true)}
              onSitOut={() => {
                if (mySeat === undefined) return;
                send({ type: 'sit_out', tableId, seat: mySeat });
              }}
              onSitIn={() => {
                if (mySeat === undefined) return;
                send({ type: 'sit_in', tableId, seat: mySeat });
              }}
              onDismiss={() => setDismissedWinHandId(table.handId)}
            />
          )}

          {topUpOpen && table && mySeat !== undefined && myPlayer && myPlayer.stack === 0 && (
            <TopUpModal
              currentStack={myPlayer.stack}
              buyIn={table.config.buyIn}
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
