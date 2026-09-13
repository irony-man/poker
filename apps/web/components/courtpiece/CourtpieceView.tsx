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
import { useIsNarrow } from '@/lib/tableLayout';
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

function teamLabel(team: 0 | 1): string {
  return team === 0 ? 'NS' : 'EW';
}

function rulesLabel(v: string): string {
  if (v === 'classic_full') return 'Classic Full';
  if (v === 'hokm') return 'Hokm';
  return 'Classic';
}

function seatAtOffset(mySeat: number, offset: number): number {
  return (mySeat + offset) % 4;
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
  const { send, leaveCourtpiece } = useCourtpieceSocket(courtpieceId, { spectate: spectating });

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
  const isSpectating = spectating && mySeat === null;
  const isHost = Boolean(board && userId && board.hostUserId === userId);
  const waiting = board?.status === 'waiting';
  const playing = board?.status === 'playing';
  const finished = board?.status === 'finished';
  const phase = board?.phase ?? 'lobby';
  const isMyTurn = playing && board?.toAct !== null && board?.toAct === mySeat;
  const choosingTrump = phase === 'choosing_trump' && isMyTurn;
  const canPlay = phase === 'playing' && isMyTurn;
  const displayCode = inviteCode || board?.inviteCode || '';
  const hand = you?.hand ?? [];
  const legal = new Set(you?.legal ?? []);
  const winnerTeam = board?.winnerTeam ?? null;
  const myTeam = you?.team ?? (mySeat !== null ? ((mySeat % 2) as 0 | 1) : null);
  const youWon = winnerTeam !== null && myTeam === winnerTeam;
  const showWin = Boolean(finished && winnerTeam !== null && !winDismissed);
  const emptySeats = seats.filter((s) => !s.userId).length;
  const botSeats = seats.filter((s) => s.isBot).length;
  const humans = seats.filter((s) => s.userId && !s.isBot);
  const readyHumans = humans.filter((s) => s.ready);

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

  const actions = (
    <div className="flex flex-col gap-2 px-3 py-3">
      <MoveTimerStrip
        endsAt={playing || phase === 'choosing_trump' ? board.turnEndsAt : null}
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
      {canPlay ? (
        <div className="flex max-w-full flex-wrap justify-center gap-1">
          {hand.map((card) => {
            const enabled = legal.size === 0 || legal.has(card);
            return (
              <button
                key={card}
                type="button"
                disabled={!enabled}
                onClick={() => playCard(card)}
                className={enabled ? '' : 'opacity-40'}
                aria-label={`Play ${card}`}
              >
                <PlayingCard code={card} size={narrow ? 'handSm' : 'hand'} dimmed={!enabled} />
              </button>
            );
          })}
        </div>
      ) : null}
      {!canPlay && mySeat !== null && hand.length > 0 && phase !== 'lobby' ? (
        <div className="flex max-w-full flex-wrap justify-center gap-1 opacity-90">
          {hand.map((card) => (
            <PlayingCard key={card} code={card} size={narrow ? 'handSm' : 'hand'} />
          ))}
        </div>
      ) : null}
      {(waiting || finished) && mySeat !== null ? (
        <Button
          type="button"
          variant={myPlayer?.ready ? 'ghost' : 'primary'}
          className="min-h-11 w-full"
          onClick={() =>
            send({ type: 'courtpiece_set_ready', courtpieceId, ready: !myPlayer?.ready })
          }
        >
          {myPlayer?.ready ? 'Not ready' : finished ? 'Play rematch' : 'Ready'}
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

  const anchor = mySeat ?? 0;
  const layoutSeats = [
    { offset: 2, pos: 'top' as const },
    { offset: 1, pos: 'right' as const },
    { offset: 0, pos: 'bottom' as const },
    { offset: 3, pos: 'left' as const },
  ];

  return (
    <TableShell
      onSend={(text) => send({ type: 'courtpiece_chat', courtpieceId, text })}
      onEmoji={(emoji) => send({ type: 'courtpiece_chat', courtpieceId, text: emoji })}
      chatOpen={chatOpen}
      onChatOpenChange={setChatOpen}
      actionsExpanded={
        canPlay ||
        choosingTrump ||
        waiting ||
        finished ||
        isSpectating ||
        Boolean(lastError) ||
        hand.length > 0
      }
      actions={actions}
      chatEmptyHint="Talk trump and tricks."
    >
      <div className="flex min-h-0 flex-1 flex-col bg-chrome text-on-chrome">
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

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 sm:px-3">
          <div className="flex flex-wrap items-center gap-2 px-0.5">
            <StatusChip tone={playing ? 'playPositive' : finished ? 'playBrass' : 'play'}>
              {finished ? 'Finished' : playing ? 'Playing' : 'Waiting'}
            </StatusChip>
            <StatusChip tone="playMuted">{rulesLabel(board.rulesVariant)}</StatusChip>
            <StatusChip tone="playMuted" className="tabular-nums">
              NS {board.teamHands[0]}–{board.teamHands[1]} EW
            </StatusChip>
            {board.trump ? (
              <StatusChip tone="playPositive">Trump {SUIT_LABEL[board.trump]}</StatusChip>
            ) : null}
            {waiting || finished ? (
              <StatusChip tone="playMuted" className="tabular-nums">
                Ready {readyHumans.length}/{Math.max(humans.length, 1)}
              </StatusChip>
            ) : null}
          </div>

          <div className="relative mx-auto aspect-[4/3] w-full max-w-xl rounded-[40%] border border-white/10 bg-[radial-gradient(ellipse_at_center,_#1a5c3a_0%,_#0d3d26_70%)] shadow-inner">
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-1">
              {(board.currentTrick ?? []).map((p) => (
                <PlayingCard key={`${p.seat}-${p.card}`} code={p.card} size="sm" />
              ))}
              {(board.currentTrick ?? []).length === 0 && playing ? (
                <span className="text-xs text-white/70">Hand {board.handNumber}</span>
              ) : null}
            </div>

            {layoutSeats.map(({ offset, pos }) => {
              const seat = seatAtOffset(anchor, offset);
              const p = seats[seat]!;
              const isTurn = board.toAct === seat;
              const posClass =
                pos === 'top'
                  ? 'left-1/2 top-2 -translate-x-1/2'
                  : pos === 'bottom'
                    ? 'bottom-2 left-1/2 -translate-x-1/2'
                    : pos === 'left'
                      ? 'left-2 top-1/2 -translate-y-1/2'
                      : 'right-2 top-1/2 -translate-y-1/2';
              return (
                <div
                  key={seat}
                  className={`absolute flex flex-col items-center gap-0.5 ${posClass} ${
                    isTurn ? 'rounded-lg p-1 ring-2 ring-amber-300/80' : ''
                  }`}
                >
                  {p.userId ? (
                    <>
                      <PlayerAvatar
                        userId={p.userId}
                        avatarId={p.avatarId}
                        avatarUrl={p.avatarUrl}
                        size={22}
                        title={p.name ?? `Seat ${seat + 1}`}
                      />
                      <span className="max-w-[5.5rem] truncate text-[10px] font-semibold text-white">
                        {p.name}
                        {p.userId === userId ? ' · you' : ''}
                      </span>
                      <span className="text-[9px] text-white/70">
                        {teamLabel(p.team)} · {p.tricksThisHand}t
                        {p.cardCount > 0 ? ` · ${p.cardCount}c` : ''}
                      </span>
                      {waiting && p.ready ? (
                        <span className="text-[9px] text-emerald-200">Ready</span>
                      ) : null}
                    </>
                  ) : waiting ? (
                    <button
                      type="button"
                      className="rounded-md border border-white/30 bg-black/30 px-2 py-1 text-[10px] text-white"
                      onClick={() => sitAt(seat)}
                      disabled={mySeat !== null}
                    >
                      Sit {seat + 1}
                    </button>
                  ) : (
                    <span className="text-[10px] text-white/50">Empty</span>
                  )}
                </div>
              );
            })}
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
          onReady={() =>
            send({
              type: 'courtpiece_set_ready',
              courtpieceId,
              ready: !myPlayer?.ready,
            })
          }
          onDismiss={() => setWinDismissed(true)}
        />
      ) : null}
    </TableShell>
  );
}
