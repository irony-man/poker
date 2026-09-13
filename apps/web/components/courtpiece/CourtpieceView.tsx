'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CopyRoomLink } from '@/components/CopyRoomLink';
import { PlayingCard } from '@/components/PlayingCard';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PlayTableLogo } from '@/components/PlayTableLogo';
import { TableOverflowMenu, type OverflowItem } from '@/components/TableOverflowMenu';
import { TableShell } from '@/components/TableShell';
import { Button, buttonClass } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { MoveTimerStrip } from '@/components/TurnTimer';
import type { ReadyRosterPlayer } from '@/components/WinHandModal';
import type { CourtpiecePlayerView, CourtpieceSuit } from '@poker/protocol';
import { fetchCourtpieceChat } from '@/lib/api';
import { buildCourtpieceJoinShareText } from '@/lib/courtpieceLink';
import { loadSavedTableColorId } from '@/lib/tableColors';
import {
  seatAnglesCourtpiece,
  seatEllipseRadii,
  seatSlotAvatarSize,
  useIsLandscapePhone,
  useIsNarrow,
} from '@/lib/tableLayout';
import { useSession } from '@/lib/store';
import { useCourtpieceSocket } from '@/lib/ws';
import { CourtpieceWinModal } from './CourtpieceWinModal';

const SUIT_LABEL: Record<CourtpieceSuit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

const SUITS: CourtpieceSuit[] = ['s', 'h', 'd', 'c'];

const SUIT_ORDER: Record<string, number> = { s: 0, h: 1, d: 2, c: 3 };
const RANK_ORDER: Record<string, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
};

function teamLabel(team: 0 | 1): string {
  return team === 0 ? 'NS' : 'EW';
}

function rulesLabel(v: string): string {
  if (v === 'classic_full') return 'Classic Full';
  if (v === 'hokm') return 'Hokm';
  return 'Classic';
}

/** Suit then high-to-low rank (♠♥♦♣). */
function sortHandCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const sa = SUIT_ORDER[a[1]?.toLowerCase() ?? ''] ?? 9;
    const sb = SUIT_ORDER[b[1]?.toLowerCase() ?? ''] ?? 9;
    if (sa !== sb) return sa - sb;
    const ra = RANK_ORDER[a[0]?.toUpperCase() ?? ''] ?? 0;
    const rb = RANK_ORDER[b[0]?.toUpperCase() ?? ''] ?? 0;
    return rb - ra;
  });
}

export function CourtpieceView({
  courtpieceId,
  inviteCode,
  initialSpectate = false,
}: {
  courtpieceId: string;
  inviteCode?: string | null;
  initialSpectate?: boolean;
}) {
  const router = useRouter();
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();
  const userId = useSession((s) => s.userId);
  const sessionToken = useSession((s) => s.sessionToken);
  const connection = useSession((s) => s.connection);
  const board = useSession((s) => s.courtpiece);
  const you = useSession((s) => s.courtpieceYou);
  const lastError = useSession((s) => s.lastError);
  const lastErrorCode = useSession((s) => s.lastErrorCode);
  const boundId = useSession((s) => s.boundCourtpieceId);
  const setError = useSession((s) => s.setError);
  const clearCourtpiece = useSession((s) => s.clearCourtpiece);
  const pushChat = useSession((s) => s.pushChat);
  const [chatOpen, setChatOpen] = useState(false);
  const [winDismissed, setWinDismissed] = useState(false);
  const [spectating, setSpectating] = useState(initialSpectate);
  const [tableColorId, setTableColorId] = useState(0);
  const { send, leaveCourtpiece } = useCourtpieceSocket(courtpieceId, { spectate: spectating });

  useEffect(() => {
    setTableColorId(loadSavedTableColorId());
  }, []);

  useEffect(() => {
    setWinDismissed(false);
  }, [board?.status, board?.winnerTeam]);

  useEffect(() => {
    let cancelled = false;
    void fetchCourtpieceChat(courtpieceId, sessionToken ? { sessionToken } : undefined)
      .then((data) => {
        if (cancelled || !data.messages?.length) return;
        if (useSession.getState().chat.length > 0) return;
        for (const line of data.messages) {
          pushChat({
            userId: line.userId,
            name: line.name,
            text: line.text,
            at: line.at,
          });
        }
      })
      .catch(() => {
        /* optional */
      });
    return () => {
      cancelled = true;
    };
  }, [courtpieceId, sessionToken, pushChat]);

  useEffect(() => {
    if (
      lastErrorCode !== 'not_found' &&
      lastErrorCode !== 'kicked' &&
      lastErrorCode !== 'account_deleted'
    ) {
      return;
    }
    if (boundId && boundId !== courtpieceId) return;
    leaveCourtpiece();
    clearCourtpiece();
    setError(null);
    router.replace('/');
  }, [lastErrorCode, boundId, courtpieceId, leaveCourtpiece, clearCourtpiece, setError, router]);

  const seats = useMemo<CourtpiecePlayerView[]>(() => {
    const bySeat = new Map((board?.seats ?? []).map((s) => [s.seat, s]));
    return Array.from({ length: 4 }, (_, seat) => {
      return (
        bySeat.get(seat) ?? {
          seat,
          userId: null,
          name: null,
          isBot: false,
          ready: false,
          cardCount: 0,
          tricksThisHand: 0,
          team: (seat % 2) as 0 | 1,
        }
      );
    });
  }, [board]);

  const mySeat =
    you?.seat ?? seats.find((s) => s.userId && s.userId === userId)?.seat ?? null;
  const myPlayer = mySeat !== null ? seats.find((s) => s.seat === mySeat) : undefined;
  const partnerSeat = mySeat !== null ? (mySeat + 2) % 4 : null;
  const isSpectating = spectating && mySeat === null;
  const isHost = Boolean(board && userId && board.hostUserId === userId);
  const waiting = board?.status === 'waiting';
  const playing = board?.status === 'playing';
  const finished = board?.status === 'finished';
  const phase = board?.phase ?? 'lobby';
  const betweenHands = phase === 'between_hands';
  const isMyTurn = playing && board?.toAct !== null && board?.toAct === mySeat;
  const choosingTrump = phase === 'choosing_trump' && isMyTurn;
  const canPlay = phase === 'playing' && isMyTurn;
  const displayCode = inviteCode || board?.inviteCode || '';
  const hand = useMemo(() => sortHandCodes(you?.hand ?? []), [you?.hand]);
  const legal = new Set(you?.legal ?? []);
  const winnerTeam = board?.winnerTeam ?? null;
  const myTeam = you?.team ?? (mySeat !== null ? ((mySeat % 2) as 0 | 1) : null);
  const youWon = winnerTeam !== null && myTeam === winnerTeam;
  const showWin = Boolean(finished && winnerTeam !== null && !winDismissed);
  const emptySeats = seats.filter((s) => !s.userId).length;
  const botSeats = seats.filter((s) => s.isBot).length;
  const humans = seats.filter((s) => s.userId && !s.isBot);
  const readyHumans = humans.filter((s) => s.ready);
  const lastHand = board?.lastHand ?? null;

  const teamTricks = useMemo((): [number, number] => {
    const t: [number, number] = [0, 0];
    for (const p of seats) {
      t[p.team] += p.tricksThisHand;
    }
    return t;
  }, [seats]);

  const seatAngles = useMemo(() => seatAnglesCourtpiece(mySeat ?? undefined), [mySeat]);
  const ellipse = seatEllipseRadii({ maxSeats: 4, compact: narrow, landscape });

  const readyPlayers: ReadyRosterPlayer[] = humans.map((p) => ({
    seat: p.seat,
    name: p.name ?? `Seat ${p.seat + 1}`,
    userId: p.userId,
    avatarId: p.avatarId,
    avatarUrl: p.avatarUrl,
    ready: p.ready,
    isSelf: p.userId === userId,
  }));

  const leaveRoom = (to = '/') => {
    leaveCourtpiece();
    clearCourtpiece();
    setError(null);
    router.push(to);
  };

  const sitAt = (seat: number) => {
    setSpectating(false);
    send({ type: 'courtpiece_sit', courtpieceId, seat });
  };

  const sitFirstOpen = () => {
    const open = seats.find((s) => !s.userId);
    if (!open) return;
    sitAt(open.seat);
  };

  const setTrump = (suit: CourtpieceSuit) => {
    if (!board) return;
    send({ type: 'courtpiece_set_trump', courtpieceId, suit, seq: board.seq });
  };

  const playCard = (card: string) => {
    if (!board || !canPlay) return;
    if (legal.size > 0 && !legal.has(card)) return;
    send({ type: 'courtpiece_play', courtpieceId, card, seq: board.seq });
  };

  const toggleReady = () => {
    send({ type: 'courtpiece_set_ready', courtpieceId, ready: !myPlayer?.ready });
  };

  if (lastErrorCode === 'not_found' || lastErrorCode === 'kicked') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-on-chrome">This board is gone.</p>
        <Button type="button" onClick={() => router.push('/')}>
          Back to lobby
        </Button>
      </div>
    );
  }

  if (!board && (lastErrorCode === 'bad_auth' || connection === 'closed')) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-on-chrome">
          {lastErrorCode === 'bad_auth' ? 'Session expired' : "Can't reach the board"}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/')}>
            Back to lobby
          </Button>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-on-chrome/70">
          {connection === 'open' ? 'Syncing board…' : 'Connecting…'}
        </p>
      </div>
    );
  }

  const mobileOverflowItems: OverflowItem[] = [];
  if (narrow) {
    if (displayCode) {
      mobileOverflowItems.push({
        id: 'copy-link',
        label: `Copy link · ${displayCode}`,
        onClick: () => {
          void navigator.clipboard
            .writeText(buildCourtpieceJoinShareText(courtpieceId, displayCode))
            .catch(() => {
              /* ignore */
            });
        },
        tone: 'accent',
      });
    }
    mobileOverflowItems.push({
      id: 'chat',
      label: 'Chat',
      onClick: () => setChatOpen(true),
      tone: 'accent',
    });
    if (isHost && waiting && emptySeats > 0) {
      mobileOverflowItems.push({
        id: 'add-bot',
        label: '+ Bot',
        onClick: () => send({ type: 'courtpiece_add_bot', courtpieceId }),
      });
    }
    if (isHost && waiting && botSeats > 0) {
      const bot = seats.find((s) => s.isBot);
      if (bot) {
        mobileOverflowItems.push({
          id: 'remove-bot',
          label: 'Remove bot',
          onClick: () => send({ type: 'courtpiece_remove_bot', courtpieceId, seat: bot.seat }),
          tone: 'danger',
        });
      }
    }
    if (mySeat !== null && (waiting || finished)) {
      mobileOverflowItems.push({
        id: 'stand',
        label: 'Stand up',
        onClick: () => send({ type: 'courtpiece_stand', courtpieceId, seat: mySeat }),
      });
    }
    mobileOverflowItems.push({
      id: 'leave',
      label: 'Leave board',
      onClick: () => leaveRoom(),
      tone: 'danger',
    });
  }

  const leftTeam: 0 | 1 = myTeam ?? 0;
  const rightTeam: 0 | 1 = (1 - leftTeam) as 0 | 1;
  const leftTitle =
    myTeam !== null ? 'Your team' : teamLabel(leftTeam);
  const rightTitle = myTeam !== null ? 'Opponents' : teamLabel(rightTeam);
  const leftSub = myTeam !== null ? teamLabel(myTeam) : 'Seats 0 & 2';
  const rightSub = myTeam !== null ? teamLabel(rightTeam) : 'Seats 1 & 3';

  const actions = (
    <div className="flex flex-col gap-2 px-3 py-3">
      <MoveTimerStrip
        endsAt={
          phase === 'playing' || phase === 'choosing_trump' ? board.turnEndsAt : null
        }
        totalMs={board.turnTimeMs ?? 20_000}
      />
      {lastError ? (
        <p className="text-center text-[11px] text-danger" role="alert">
          {lastError}
        </p>
      ) : null}
      {choosingTrump ? (
        <div className="flex flex-wrap justify-center gap-2">
          <p className="w-full text-center text-[11px] font-display font-semibold uppercase tracking-wider text-primary">
            Choose trump
          </p>
          {SUITS.map((suit) => (
            <Button key={suit} type="button" size="sm" onClick={() => setTrump(suit)}>
              {SUIT_LABEL[suit]}
            </Button>
          ))}
        </div>
      ) : null}
      {(canPlay || (mySeat !== null && hand.length > 0 && phase === 'playing')) && (
        <div className="flex max-w-full flex-wrap justify-center gap-1">
          {hand.map((card) => {
            const enabled = canPlay && (legal.size === 0 || legal.has(card));
            const dimmed = canPlay ? !enabled : false;
            return (
              <button
                key={card}
                type="button"
                disabled={!canPlay || !enabled}
                onClick={() => playCard(card)}
                className={enabled || !canPlay ? '' : 'opacity-40'}
                aria-label={canPlay ? `Play ${card}` : card}
              >
                <PlayingCard
                  code={card}
                  size={narrow ? 'handSm' : 'hand'}
                  dimmed={dimmed}
                />
              </button>
            );
          })}
        </div>
      )}
      {(waiting || finished || betweenHands) && mySeat !== null ? (
        <Button
          type="button"
          variant={myPlayer?.ready ? 'ghost' : 'primary'}
          className="min-h-11 w-full"
          onClick={toggleReady}
        >
          {myPlayer?.ready
            ? 'Not ready'
            : finished
              ? 'Play rematch'
              : betweenHands
                ? 'Ready for next hand'
                : 'Ready'}
        </Button>
      ) : null}
      {isSpectating ? (
        <Button type="button" className="min-h-11 w-full" onClick={sitFirstOpen}>
          Sit and play
        </Button>
      ) : null}
      {isHost && waiting && emptySeats > 0 ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-10 w-full"
          onClick={() => send({ type: 'courtpiece_add_bot', courtpieceId })}
        >
          Add bot
        </Button>
      ) : null}
      {isHost && waiting && botSeats > 0 ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-10 w-full"
          onClick={() => {
            const bot = seats.find((s) => s.isBot);
            if (bot) send({ type: 'courtpiece_remove_bot', courtpieceId, seat: bot.seat });
          }}
        >
          Remove bot
        </Button>
      ) : null}
      {mySeat !== null && (waiting || finished) ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-10 w-full"
          onClick={() => send({ type: 'courtpiece_stand', courtpieceId, seat: mySeat })}
        >
          Stand up
        </Button>
      ) : null}
    </div>
  );

  return (
    <TableShell
      tableColorId={tableColorId}
      onSend={(text) => send({ type: 'courtpiece_chat', courtpieceId, text })}
      onEmoji={(emoji) => send({ type: 'courtpiece_chat', courtpieceId, text: emoji })}
      chatOpen={chatOpen}
      onChatOpenChange={setChatOpen}
      actionsExpanded={
        canPlay ||
        choosingTrump ||
        waiting ||
        finished ||
        betweenHands ||
        isSpectating ||
        Boolean(lastError) ||
        hand.length > 0
      }
      actions={actions}
      chatEmptyHint="Talk trump and tricks."
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="play-chrome-bar">
          <div className="play-table-logo-row">
            <PlayTableLogo />
            {isSpectating ? (
              <span
                className={buttonClass(
                  'chrome',
                  'md',
                  'cursor-default border-brass/35 bg-brass/15 text-[10px] uppercase tracking-wider hover:border-brass/35 hover:bg-brass/15',
                )}
              >
                Spec
              </span>
            ) : null}
          </div>

          {narrow ? (
            <div className="play-chrome-rail">
              {displayCode ? (
                <CopyRoomLink tableId={courtpieceId} inviteCode={displayCode} compact kind="courtpiece" />
              ) : null}
              <TableOverflowMenu items={mobileOverflowItems} />
            </div>
          ) : (
            <div className="play-chrome-rail">
              {displayCode ? (
                <CopyRoomLink tableId={courtpieceId} inviteCode={displayCode} kind="courtpiece" />
              ) : null}
              <span className="play-chrome-divider" aria-hidden />
              <Button type="button" variant="chromeLeave" onClick={() => leaveRoom()}>
                Leave
              </Button>
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2 sm:px-3">
          <div className="flex flex-wrap items-center gap-2 px-0.5">
            <StatusChip
              tone={
                finished
                  ? 'playBrass'
                  : betweenHands
                    ? 'playBrass'
                    : playing
                      ? 'playPositive'
                      : 'play'
              }
            >
              {finished
                ? 'Finished'
                : betweenHands
                  ? 'Between hands'
                  : playing
                    ? 'Playing'
                    : 'Waiting'}
            </StatusChip>
            <StatusChip tone="playMuted">{rulesLabel(board.rulesVariant)}</StatusChip>
            <StatusChip tone="playMuted" className="tabular-nums">
              Hands NS {board.teamHands[0]}–{board.teamHands[1]} EW · first to{' '}
              {board.handsToWin}
            </StatusChip>
            {board.trump ? (
              <StatusChip tone="playPositive">Trump {SUIT_LABEL[board.trump]}</StatusChip>
            ) : null}
            {waiting || finished || betweenHands ? (
              <StatusChip tone="playMuted" className="tabular-nums">
                Ready {readyHumans.length}/{Math.max(humans.length, 1)}
              </StatusChip>
            ) : null}
          </div>

          <div className="play-table-stage min-h-[18rem] flex-1">
            <div className="relative min-h-0 min-w-0 flex-1">
              <div
                className={
                  narrow
                    ? 'absolute inset-0 overflow-hidden felt-surface'
                    : 'absolute inset-0 overflow-hidden felt-surface table-rim shadow-felt rounded-[42%] border-[12px]'
                }
              >
                {!narrow ? <div className="play-table-oval-ring" /> : null}

                <div className="absolute left-1/2 top-1/2 z-20 flex w-[min(92%,20rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
                  {betweenHands && lastHand ? (
                    <div className="rounded-lg bg-black/45 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
                      <p className="text-[11px] font-display font-semibold uppercase tracking-wider text-felt-neon">
                        {teamLabel(lastHand.winningTeam)} wins the hand
                        {lastHand.handsAwarded > 1 ? ` (+${lastHand.handsAwarded})` : ''}
                      </p>
                      <p className="mt-0.5 text-[10px] table-label-on-felt tabular-nums">
                        Tricks {lastHand.tricks[0]}–{lastHand.tricks[1]} · Ready for next
                      </p>
                    </div>
                  ) : (board.currentTrick ?? []).length > 0 ? (
                    <div className="flex gap-1">
                      {(board.currentTrick ?? []).map((p) => (
                        <PlayingCard key={`${p.seat}-${p.card}`} code={p.card} size="sm" />
                      ))}
                    </div>
                  ) : null}

                  {(playing || betweenHands || waiting) && (
                    <div className="grid w-full grid-cols-2 gap-2 rounded-lg bg-black/40 px-2.5 py-2 backdrop-blur-sm">
                      <div className="text-center">
                        <p className="text-[9px] font-display font-bold uppercase tracking-wider text-[rgb(var(--table-accent))]">
                          {leftTitle}
                        </p>
                        <p className="text-[8px] table-label-on-felt opacity-80">{leftSub}</p>
                        <p className="mt-0.5 text-lg font-black tabular-nums text-white">
                          {board.teamHands[leftTeam]}
                        </p>
                        <p className="text-[9px] table-label-on-felt tabular-nums">
                          {teamTricks[leftTeam]} tricks
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-display font-bold uppercase tracking-wider text-felt-neon">
                          {rightTitle}
                        </p>
                        <p className="text-[8px] table-label-on-felt opacity-80">{rightSub}</p>
                        <p className="mt-0.5 text-lg font-black tabular-nums text-white">
                          {board.teamHands[rightTeam]}
                        </p>
                        <p className="text-[9px] table-label-on-felt tabular-nums">
                          {teamTricks[rightTeam]} tricks
                        </p>
                      </div>
                      <p className="col-span-2 text-center text-[9px] table-label-on-felt opacity-70">
                        First to {board.handsToWin}
                        {playing && !betweenHands ? ` · Hand ${board.handNumber}` : ''}
                      </p>
                    </div>
                  )}

                  {!playing && !betweenHands && waiting ? (
                    <span className="table-label-on-felt text-[10px] font-display uppercase tracking-wider">
                      Court Piece
                    </span>
                  ) : null}
                </div>

                {seats.map((p) => {
                  const angle = seatAngles[p.seat] ?? 90;
                  const rad = (angle * Math.PI) / 180;
                  const x = 50 + Math.cos(rad) * ellipse.rx;
                  const y = 50 + Math.sin(rad) * ellipse.ry;
                  const isTurn = board.toAct === p.seat;
                  const isSelf = p.userId === userId;
                  const isPartner = partnerSeat !== null && p.seat === partnerSeat;
                  const isNs = p.team === 0;
                  const avatarSize = seatSlotAvatarSize({
                    maxSeats: 4,
                    compact: narrow,
                    isSelf,
                  });
                  return (
                    <div
                      key={p.seat}
                      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <div
                        className={`flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-1 ${
                          isTurn
                            ? 'ring-2 ring-[rgb(var(--table-accent))] ring-offset-1 ring-offset-transparent'
                            : ''
                        }`}
                      >
                        {p.userId ? (
                          <>
                            <div className="relative">
                              <div
                                className={`rounded-full p-0.5 ${
                                  isNs
                                    ? 'bg-[rgb(var(--table-accent))]/90'
                                    : 'bg-[rgb(var(--positive))]/90'
                                }`}
                              >
                                <div className="table-chrome-disc rounded-full p-0.5">
                                  <PlayerAvatar
                                    userId={p.userId}
                                    avatarId={p.avatarId}
                                    avatarUrl={p.avatarUrl}
                                    size={avatarSize}
                                    title={p.name ?? `Seat ${p.seat + 1}`}
                                  />
                                </div>
                              </div>
                              <span
                                className={`absolute -right-1 -top-1 rounded px-1 text-[8px] font-black uppercase tracking-wide text-black ${
                                  isNs
                                    ? 'bg-[rgb(var(--table-accent))]'
                                    : 'bg-[rgb(var(--positive))]'
                                }`}
                              >
                                {teamLabel(p.team)}
                              </span>
                            </div>
                            <span className="table-label-on-felt max-w-[5.5rem] truncate text-[10px] font-semibold">
                              {p.name}
                              {isSelf ? ' · you' : ''}
                            </span>
                            {isPartner ? (
                              <span className="text-[9px] font-display font-bold uppercase tracking-wider text-felt-neon">
                                Partner
                              </span>
                            ) : null}
                            <span className="table-label-on-felt text-[9px] opacity-80">
                              {p.tricksThisHand} trick{p.tricksThisHand === 1 ? '' : 's'}
                              {p.cardCount > 0 ? ` · ${p.cardCount} cards` : ''}
                            </span>
                            {(waiting || betweenHands || finished) && p.ready ? (
                              <span className="text-[9px] font-display uppercase tracking-wider text-felt-neon">
                                Ready
                              </span>
                            ) : null}
                          </>
                        ) : waiting ? (
                          <button
                            type="button"
                            className="rounded-md border border-white/25 bg-black/35 px-2 py-1 text-[10px] text-white"
                            onClick={() => sitAt(p.seat)}
                            disabled={mySeat !== null}
                          >
                            Sit {p.seat + 1}
                          </button>
                        ) : (
                          <span className="table-label-on-felt text-[10px] opacity-50">Empty</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showWin && winnerTeam !== null ? (
        <CourtpieceWinModal
          winningTeam={winnerTeam}
          youWon={youWon}
          teamHands={board.teamHands}
          handsToWin={board.handsToWin}
          canReady={mySeat !== null && !myPlayer?.isBot}
          isReady={Boolean(myPlayer?.ready)}
          readyPlayers={readyPlayers}
          readyCount={readyHumans.length}
          readyTotal={humans.length}
          onReady={toggleReady}
          onDismiss={() => setWinDismissed(true)}
        />
      ) : null}
    </TableShell>
  );
}
