'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ActionControls } from './ActionControls';
import { CommunityBoard } from './CommunityBoard';
import { DealerPotZone } from './DealerPotZone';
import { HowToPlayHelp } from './HowToPlayHelp';
import { SeatView } from './SeatView';
import { CopyRoomLink } from './CopyRoomLink';
import {
  LeaderboardToggle,
  TableLeaderboard,
  loadShowLeaderboard,
  saveShowLeaderboard,
} from './TableLeaderboard';
import { TableOverflowMenu, type OverflowItem } from './TableOverflowMenu';
import { TableShell } from './TableShell';
import { TopUpModal } from './TopUpModal';
import { VoiceCallBar } from './VoiceCallBar';
import { WinHandModal } from './WinHandModal';
import { playTick } from '@/lib/audio';
import { buildTableJoinShareText } from '@/lib/tableLink';
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
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const prevVersion = useRef<number | null>(null);
  const autoSitSent = useRef(false);

  useEffect(() => {
    setShowLeaderboard(loadShowLeaderboard());
  }, []);

  const toggleLeaderboard = () => {
    setShowLeaderboard((prev) => {
      const next = !prev;
      saveShowLeaderboard(next);
      return next;
    });
  };

  useEffect(() => {
    if (lastErrorCode !== 'not_found' && lastErrorCode !== 'kicked') return;
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
    !table?.tournament?.noTopUp &&
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
  const isTournament = Boolean(table?.tournament);
  const isHost = !!userId && table?.hostUserId === userId;
  /** Humans + bots eligible for next cash hand. */
  const eligiblePlayers =
    table?.players.filter(
      (p) => p.userId && p.stack > 0 && p.status !== 'sittingOut' && p.status !== 'empty',
    ) ?? [];
  const readyCount = eligiblePlayers.filter((p) => p.ready).length;
  const myReady = !!myPlayer?.ready;
  const canReady =
    !isTournament &&
    betweenHands &&
    mySeat !== undefined &&
    myPlayer?.status !== 'sittingOut' &&
    (myPlayer?.stack ?? 0) > 0 &&
    eligiblePlayers.length >= 2;
  /** Desktop keeps the full pill row; mobile only shows Ready/Sit CTA between hands. */
  const showDesktopTools =
    !narrow &&
    (isSpectating ||
      canSitOut ||
      canSitIn ||
      canTopUp ||
      (!isTournament && !isSpectating && emptySeats > 0) ||
      (!isTournament && !isSpectating && botSeats > 0) ||
      canReady);
  const showMobileStartCta = narrow && (canReady || isSpectating);

  const onAction = (action: string, amount?: number) => {
    if (!table) return;
    if (connection !== 'open') {
      setError('Disconnected — wait for reconnect, then try again');
      return;
    }
    const ok = send({
      type: 'action',
      tableId,
      handId: table.handId,
      seq: table.actionSeq,
      action,
      amount,
    });
    if (!ok) {
      setError('Could not send action — connection lost');
    }
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
        <p className="text-ink-strong-muted">Table not found — returning home…</p>
      </div>
    );
  }

  if (!table && (connection === 'connecting' || connection === 'open')) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-ink-strong-muted">
          {connection === 'connecting' ? 'Connecting…' : 'Loading table…'}
        </p>
      </div>
    );
  }

  if (!table && connection === 'closed') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-ink-strong">Can&apos;t reach the table</p>
        <p className="max-w-sm text-sm text-ink-strong-muted">
          The connection closed before table data arrived. Check that the server is running, then
          try again.
        </p>
        <button type="button" className="btn-primary" onClick={() => router.push('/')}>
          Back to lobby
        </button>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-ink-strong-muted">Syncing table…</p>
      </div>
    );
  }

  const mobileOverflowItems: OverflowItem[] = [];
  if (narrow) {
    if (inviteCode) {
      mobileOverflowItems.push({
        id: 'copy-link',
        label: `Copy link · ${inviteCode}`,
        onClick: () => {
          void (async () => {
            const text = buildTableJoinShareText(tableId, inviteCode);
            try {
              await navigator.clipboard.writeText(text);
            } catch {
              /* ignore */
            }
          })();
        },
        tone: 'accent',
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
    mobileOverflowItems.push({
      id: 'leaderboard',
      label: showLeaderboard ? 'Hide leaderboard' : 'Show leaderboard',
      onClick: toggleLeaderboard,
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
      actionsExpanded={!!isMyTurn}
      actions={
        <ActionControls
          onAction={onAction}
          spectating={isSpectating}
          bare
          connectionOpen={connection === 'open'}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Mobile controls | Desktop chrome — brand mark top-left */}
        <div className="mb-1 flex shrink-0 items-center justify-between gap-2 px-1.5 text-sm text-ink-strong-muted sm:mb-2 sm:px-0">
          <div className="flex min-w-0 items-center gap-2">
            <Image
              src="/purple-logo.png"
              alt="POKR"
              width={140}
              height={40}
              className="h-7 w-auto object-contain object-left sm:h-8"
              priority
            />
            {isSpectating && (
              <span className="status-chip shrink-0 border-brass/40 bg-brass/15 text-ink-strong max-sm:text-[10px]">
                Spec
              </span>
            )}
          </div>

          {narrow ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {inviteCode ? (
                <CopyRoomLink tableId={tableId} inviteCode={inviteCode} compact />
              ) : null}
              <HowToPlayHelp />
              <TableOverflowMenu
                items={mobileOverflowItems}
                footer={
                  <div className="flex items-center gap-2 text-[10px] text-ink-strong-muted">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        connection === 'open'
                          ? 'bg-felt-neon animate-live-blink'
                          : connection === 'connecting'
                            ? 'bg-amber-300 animate-live-blink'
                            : 'bg-red-400'
                      }`}
                    />
                    {connection === 'open'
                      ? 'Live'
                      : connection === 'connecting'
                        ? 'Reconnecting'
                        : 'Offline'}
                  </div>
                }
              />
            </div>
          ) : (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
              {inviteCode ? (
                <CopyRoomLink tableId={tableId} inviteCode={inviteCode} />
              ) : null}
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
              <LeaderboardToggle open={showLeaderboard} onToggle={toggleLeaderboard} />
              <HowToPlayHelp />
              <div
                className={
                  connection === 'open'
                    ? 'status-chip border-positive/35 bg-positive/10 text-positive'
                    : connection === 'connecting'
                      ? 'status-chip border-amber-500/35 bg-amber-500/10 text-amber-800'
                      : 'status-chip border-danger/35 bg-danger/10 text-danger'
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
                <span>
                  {connection === 'open'
                    ? 'Live'
                    : connection === 'connecting'
                      ? 'Reconnecting'
                      : 'Offline'}
                </span>
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

        {table?.tournament && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="status-chip border-sidebar/25 bg-sidebar/8 text-sidebar">
              {table.tournament.mode === 'knockout' ? 'Knockout' : 'Table match'}
              {table.tournament.frozen ? ' · match over' : ''}
            </span>
            <span className="text-xs text-ink-strong-muted">
              Blinds {table.config.smallBlind}/{table.config.bigBlind} · no rebuy
            </span>
            {table.tournament.contestId && (
              <a
                href={`/contest/${table.tournament.contestId}`}
                className="text-xs text-sidebar underline"
              >
                Contest lobby
              </a>
            )}
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 min-w-0 flex-1">
          <div
            className={
              narrow
                ? 'absolute inset-0 overflow-hidden felt-surface'
                : 'absolute inset-0 overflow-hidden felt-surface table-rim shadow-felt rounded-[42%] border-[12px]'
            }
          >
          {!narrow ? (
            <div className="pointer-events-none absolute inset-6 z-[1] rounded-[40%] border border-white/10" />
          ) : null}

          <TableLeaderboard
            players={table?.players ?? []}
            userId={userId}
            open={showLeaderboard}
            onClose={() => {
              setShowLeaderboard(false);
              saveShowLeaderboard(false);
            }}
            compact={narrow}
          />

          <div
            className={`absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 ${
              landscape ? 'top-[14%]' : narrow ? 'top-[7%] scale-90' : 'top-[10%]'
            }`}
          >
            <DealerPotZone
              amount={Math.max(potTotal, table?.pot ?? 0)}
              sidePotCount={table?.sidePots?.length ?? 0}
              dealerName={narrow || landscape ? undefined : dealerPlayer?.name}
              showDealer={showDealerZone}
              landscape={landscape}
            />
          </div>

          <div
            className={`absolute left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${
              landscape ? 'top-[40%]' : narrow ? 'top-[38%]' : 'top-[42%]'
            }`}
          >
            <CommunityBoard
              cards={table?.community ?? []}
              handId={table?.handId}
              cardSize={narrow ? 'sm' : 'md'}
              compact={narrow}
              landscape={landscape}
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
                canManageBots={!isSpectating && !isTournament}
                spectating={isSpectating}
                compact={narrow}
                landscape={landscape}
                isDealer={table.dealerButton === p.seat}
                showReady={betweenHands && !isTournament && !!p.ready}
                canKick={
                  isHost &&
                  betweenHands &&
                  !isTournament &&
                  !!p.userId &&
                  p.userId !== userId &&
                  p.status !== 'empty'
                }
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
                onKick={() => send({ type: 'kick_player', tableId, seat: p.seat })}
              />
            );
          })}
          </div>
          </div>

          {showMobileStartCta && (
            <div className="relative z-30 flex shrink-0 flex-col items-center gap-1 px-1 pb-0.5 pt-1">
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
                <>
                  <button
                    type="button"
                    onClick={() => send({ type: 'set_ready', tableId, ready: !myReady })}
                    className={`min-h-10 px-5 text-[11px] font-display font-bold uppercase tracking-wide ${
                      myReady ? 'btn-ghost' : 'btn-primary'
                    }`}
                  >
                    {myReady ? 'Not ready' : 'Ready'}
                  </button>
                  <span className="text-[10px] font-display uppercase tracking-wider text-ink-strong-muted">
                    {readyCount}/{eligiblePlayers.length} ready
                  </span>
                </>
              )}
            </div>
          )}

          {showDesktopTools && (
          <div className="relative z-30 flex shrink-0 justify-center px-2 pb-1 pt-2">
            <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border border-sidebar/15 bg-white/80 px-2 py-1.5 shadow-[0_8px_24px_rgb(29_4_50/0.1)] backdrop-blur-md">
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
              {canReady && (
                <>
                  <button
                    type="button"
                    onClick={() => send({ type: 'set_ready', tableId, ready: !myReady })}
                    className={`text-xs py-1.5 ${
                      myReady
                        ? 'rounded-full border border-sidebar/40 bg-sidebar/10 px-3 text-sidebar'
                        : 'btn-ghost'
                    }`}
                  >
                    {myReady ? 'Ready ✓' : 'Ready'}
                  </button>
                  <span className="px-1 text-[10px] font-display uppercase tracking-wider text-ink-strong-muted">
                    {readyCount}/{eligiblePlayers.length}
                  </span>
                </>
              )}
              {!isSpectating && !isTournament && emptySeats > 0 && (
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
                    className="rounded-full border border-sidebar/20 px-3 py-1.5 text-xs text-ink-strong hover:bg-sidebar/8"
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
                    className="rounded-full border border-sidebar/12 px-2.5 py-1.5 text-[10px] text-ink-strong-muted hover:bg-sidebar/8"
                  >
                    Fill
                  </button>
                </>
              )}
              {!isSpectating && botSeats > 0 && (
                <button
                  type="button"
                  onClick={() => send({ type: 'remove_all_bots', tableId })}
                  className="rounded-full px-2.5 py-1.5 text-[10px] text-ink-strong-muted hover:text-danger"
                >
                  − Bots
                </button>
              )}
              {canSitOut && (
                <button
                  type="button"
                  onClick={() => send({ type: 'sit_out', tableId, seat: mySeat! })}
                  className="rounded-full border border-amber-600/30 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-500/10"
                >
                  Sit out
                </button>
              )}
              {canSitIn && (
                <button
                  type="button"
                  onClick={() => send({ type: 'sit_in', tableId, seat: mySeat! })}
                  className="rounded-full border border-sidebar/30 bg-sidebar/8 px-3 py-1.5 text-xs text-sidebar hover:bg-sidebar/12"
                >
                  Sit in
                </button>
              )}
              {canTopUp && (
                <button
                  type="button"
                  onClick={() => setTopUpOpen(true)}
                  className="rounded-full border border-sidebar/25 bg-sidebar/8 px-3 py-1.5 text-xs text-sidebar hover:bg-sidebar/12"
                >
                  Top up
                </button>
              )}
            </div>
          </div>
          )}
        </div>

      </div>

          {showWinModal && table && (
            <WinHandModal
              youWon={youWon}
              canStartNext={canReady}
              readyCount={readyCount}
              readyTotal={eligiblePlayers.length}
              isReady={myReady}
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
                send({ type: 'set_ready', tableId, ready: !myReady });
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
