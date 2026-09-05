'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CopyRoomLink } from '@/components/CopyRoomLink';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { TableOverflowMenu, type OverflowItem } from '@/components/TableOverflowMenu';
import { TableShell } from '@/components/TableShell';
import { Button, buttonClass } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { MoveTimerStrip } from '@/components/TurnTimer';
import type { ReadyRosterPlayer } from '@/components/WinHandModal';
import type { LudoPlayerView } from '@poker/protocol';
import { fetchLudoChat } from '@/lib/api';
import { ludoColorForSeat, ludoHexForSeat } from '@/lib/ludoBoard';
import { useIsNarrow } from '@/lib/tableLayout';
import { useSession } from '@/lib/store';
import { useLudoSocket } from '@/lib/ws';
import { LudoBoard } from './LudoBoard';
import { LudoWinModal } from './LudoWinModal';

export function LudoView({
  ludoId,
  inviteCode,
  initialSpectate = false,
}: {
  ludoId: string;
  inviteCode?: string | null;
  initialSpectate?: boolean;
}) {
  const router = useRouter();
  const narrow = useIsNarrow();
  const userId = useSession((s) => s.userId);
  const sessionToken = useSession((s) => s.sessionToken);
  const connection = useSession((s) => s.connection);
  const ludo = useSession((s) => s.ludo);
  const ludoYou = useSession((s) => s.ludoYou);
  const legalMoves = useSession((s) => s.ludoLegalMoves);
  const lastError = useSession((s) => s.lastError);
  const lastErrorCode = useSession((s) => s.lastErrorCode);
  const boundLudoId = useSession((s) => s.boundLudoId);
  const setError = useSession((s) => s.setError);
  const clearLudo = useSession((s) => s.clearLudo);
  const pushChat = useSession((s) => s.pushChat);
  const [chatOpen, setChatOpen] = useState(false);
  const [winDismissed, setWinDismissed] = useState(false);
  const [spectating, setSpectating] = useState(initialSpectate);
  const { send, leaveLudo } = useLudoSocket(ludoId, { spectate: spectating });

  useEffect(() => {
    setWinDismissed(false);
  }, [ludo?.status, ludo?.winnerSeat]);

  useEffect(() => {
    let cancelled = false;
    void fetchLudoChat(ludoId, sessionToken ? { sessionToken } : undefined)
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
        /* chat history is optional until the server lands */
      });
    return () => {
      cancelled = true;
    };
  }, [ludoId, sessionToken, pushChat]);

  useEffect(() => {
    if (
      lastErrorCode !== 'not_found' &&
      lastErrorCode !== 'kicked' &&
      lastErrorCode !== 'account_deleted'
    ) {
      return;
    }
    if (boundLudoId && boundLudoId !== ludoId) return;
    leaveLudo();
    clearLudo();
    setError(null);
    router.replace('/');
  }, [lastErrorCode, boundLudoId, ludoId, leaveLudo, clearLudo, setError, router]);

  const seats = useMemo<LudoPlayerView[]>(() => {
    const max = ludo?.maxSeats ?? 4;
    const bySeat = new Map((ludo?.seats ?? []).map((s) => [s.seat, s]));
    return Array.from({ length: max }, (_, seat) => {
      return (
        bySeat.get(seat) ?? {
          seat,
          userId: null,
          name: null,
          isBot: false,
          ready: false,
          tokens: [],
        }
      );
    });
  }, [ludo]);

  const mySeat = ludoYou?.seat ?? seats.find((s) => s.userId && s.userId === userId)?.seat ?? null;
  const myPlayer = mySeat !== null ? seats.find((s) => s.seat === mySeat) : undefined;
  const isSpectating = spectating && mySeat === null;
  const isHost = Boolean(ludo && userId && ludo.hostUserId === userId);
  const waiting = ludo?.status === 'waiting';
  const playing = ludo?.status === 'playing';
  const finished = ludo?.status === 'finished';
  const isMyTurn = playing && ludo?.toAct !== null && ludo?.toAct === mySeat;
  const needRoll = isMyTurn && ludo?.die == null;
  const needMove = isMyTurn && ludo?.die != null && legalMoves.length > 0;
  const emptySeats = seats.filter((s) => !s.userId).length;
  const botSeats = seats.filter((s) => s.isBot).length;
  const humans = seats.filter((s) => s.userId && !s.isBot);
  const readyHumans = humans.filter((s) => s.ready);
  const displayCode = inviteCode || ludo?.inviteCode || '';

  const readyPlayers: ReadyRosterPlayer[] = humans.map((p) => ({
    seat: p.seat,
    name: p.name ?? ludoColorForSeat(p.seat),
    userId: p.userId,
    avatarId: p.avatarId,
    avatarUrl: p.avatarUrl,
    ready: p.ready,
    isSelf: p.userId === userId,
  }));

  const leaveRoom = (to = '/') => {
    leaveLudo();
    clearLudo();
    setError(null);
    router.push(to);
  };

  const sitAt = (seat: number) => {
    setSpectating(false);
    send({ type: 'ludo_sit', ludoId, seat });
  };

  const sitFirstOpen = () => {
    const open = seats.find((s) => !s.userId);
    if (!open) return;
    sitAt(open.seat);
  };

  const winner = finished && ludo?.winnerSeat != null
    ? seats.find((s) => s.seat === ludo.winnerSeat)
    : undefined;
  const showWin = Boolean(finished && winner && !winDismissed);

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

  if (!ludo && (lastErrorCode === 'bad_auth' || connection === 'closed')) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-on-chrome">
          {lastErrorCode === 'bad_auth' ? 'Session expired' : "Can't reach the board"}
        </p>
        <p className="max-w-sm text-sm text-on-chrome/70">
          {lastError ??
            (lastErrorCode === 'bad_auth'
              ? 'Sign in again, then reopen the board.'
              : 'Check that the server is awake, then try again.')}
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

  if (!ludo) {
    return (
      <div className="flex flex-1 items-center justify-center">
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
          void navigator.clipboard.writeText(
            `Join my POKR Ludo board\nCode: ${displayCode}\n${window.location.origin}/ludo/${ludoId}?invite=${displayCode}`,
          ).catch(() => {
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
        onClick: () => send({ type: 'ludo_add_bot', ludoId }),
      });
    }
    if (isHost && waiting && botSeats > 0) {
      const bot = seats.find((s) => s.isBot);
      if (bot) {
        mobileOverflowItems.push({
          id: 'remove-bot',
          label: 'Remove bot',
          onClick: () => send({ type: 'ludo_remove_bot', ludoId, seat: bot.seat }),
          tone: 'danger',
        });
      }
    }
    if (mySeat !== null && (waiting || finished)) {
      mobileOverflowItems.push({
        id: 'stand',
        label: 'Stand up',
        onClick: () => send({ type: 'ludo_stand', ludoId, seat: mySeat }),
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
        endsAt={playing ? ludo.turnEndsAt : null}
        totalMs={ludo.turnTimeMs ?? 20_000}
      />
      {lastError ? (
        <p className="text-center text-[11px] text-danger" role="alert">
          {lastError}
        </p>
      ) : null}
      {needRoll ? (
        <Button
          type="button"
          className="min-h-12 w-full text-base"
          onClick={() => send({ type: 'ludo_roll', ludoId, seq: ludo.seq })}
        >
          Roll
        </Button>
      ) : null}
      {needMove ? (
        <p className="text-center text-[11px] font-display font-semibold uppercase tracking-wider text-ink-strong">
          Tap a highlighted token · {ludo.die}
        </p>
      ) : null}
      {isMyTurn && ludo.die != null && legalMoves.length === 0 ? (
        <p className="text-center text-[11px] text-ink-strong-muted">No legal moves</p>
      ) : null}
      {playing && !isMyTurn ? (
        <p className="text-center text-[11px] text-ink-strong-muted">
          {ludo.toAct != null
            ? `${seats.find((s) => s.seat === ludo.toAct)?.name ?? ludoColorForSeat(ludo.toAct)} to act`
            : 'Waiting…'}
        </p>
      ) : null}
      {(waiting || finished) && mySeat !== null ? (
        <Button
          type="button"
          variant={myPlayer?.ready ? 'ghost' : 'primary'}
          className="min-h-11 w-full"
          onClick={() =>
            send({ type: 'ludo_set_ready', ludoId, ready: !myPlayer?.ready })
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
          onClick={() => send({ type: 'ludo_add_bot', ludoId })}
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
            if (bot) send({ type: 'ludo_remove_bot', ludoId, seat: bot.seat });
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
          onClick={() => send({ type: 'ludo_stand', ludoId, seat: mySeat })}
        >
          Stand up
        </Button>
      ) : null}
    </div>
  );

  return (
    <TableShell
      onSend={(text) => send({ type: 'ludo_chat', ludoId, text })}
      onEmoji={(emoji) => send({ type: 'ludo_chat', ludoId, text: emoji })}
      chatOpen={chatOpen}
      onChatOpenChange={setChatOpen}
      actionsExpanded={
        needRoll ||
        needMove ||
        waiting ||
        finished ||
        isSpectating ||
        Boolean(lastError)
      }
      actions={actions}
      chatEmptyHint="Cheer a capture or call the next six."
    >
      <div className="flex min-h-0 flex-1 flex-col bg-ink text-on-chrome">
        <header className="play-chrome-bar">
          <div className="play-table-logo-row">
            <Image
              src="/purple-logo.png"
              alt="POKR"
              width={140}
              height={40}
              className="play-table-logo"
              priority
            />
            {isSpectating ? (
              <span
                className={buttonClass(
                  'chrome',
                  'md',
                  'cursor-default border-brass/35 bg-brass/15 text-[10px] uppercase tracking-wider text-sidebar hover:border-brass/35 hover:bg-brass/15',
                )}
              >
                Spec
              </span>
            ) : null}
          </div>

          {narrow ? (
            <div className="play-chrome-rail">
              {displayCode ? (
                <CopyRoomLink tableId={ludoId} inviteCode={displayCode} compact kind="ludo" />
              ) : null}
              <TableOverflowMenu items={mobileOverflowItems} />
            </div>
          ) : (
            <div className="play-chrome-rail">
              {displayCode ? (
                <CopyRoomLink tableId={ludoId} inviteCode={displayCode} kind="ludo" />
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
            <StatusChip tone={playing ? 'positive' : finished ? 'brass' : 'neutral'}>
              {finished ? 'Finished' : playing ? 'Playing' : 'Waiting'}
            </StatusChip>
            {ludo.die != null ? (
              <StatusChip tone="brass" className="tabular-nums">
                Die {ludo.die}
              </StatusChip>
            ) : null}
            {waiting || finished ? (
              <StatusChip tone="muted" className="tabular-nums">
                Ready {readyHumans.length}/{Math.max(humans.length, 1)}
              </StatusChip>
            ) : null}
            {playing && ludo.toAct != null ? (
              <StatusChip tone="positive">
                {ludo.toAct === mySeat
                  ? 'Your turn'
                  : `${seats.find((s) => s.seat === ludo.toAct)?.name ?? ludoColorForSeat(ludo.toAct)}`}
              </StatusChip>
            ) : null}
          </div>

          <ul className="flex flex-wrap gap-2 px-0.5">
            {seats.map((p) => {
              const color = ludoColorForSeat(p.seat);
              const hex = ludoHexForSeat(p.seat);
              const empty = !p.userId;
              const toAct = playing && ludo.toAct === p.seat;
              return (
                <li key={p.seat}>
                  {empty ? (
                    <button
                      type="button"
                      disabled={mySeat !== null && !isSpectating}
                      onClick={() => sitAt(p.seat)}
                      className="flex items-center gap-1.5 rounded-full border border-on-chrome/20 bg-ink-raised px-2.5 py-1 text-[11px] text-on-chrome/80 hover:border-on-chrome/40 disabled:opacity-50"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: hex }}
                        aria-hidden
                      />
                      Sit {color}
                    </button>
                  ) : (
                    <div
                      className={`flex items-center gap-1.5 rounded-full border px-2 py-1 ${
                        toAct
                          ? 'border-brass/50 bg-brass/15'
                          : 'border-on-chrome/15 bg-ink-raised'
                      }`}
                    >
                      <PlayerAvatar
                        userId={p.userId}
                        avatarId={p.avatarId}
                        avatarUrl={p.avatarUrl}
                        size={22}
                        title={p.name ?? color}
                      />
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: hex }}
                        aria-hidden
                      />
                      <span className="max-w-[7rem] truncate text-[11px] font-medium text-on-chrome">
                        {p.userId === userId ? 'You' : p.name ?? color}
                      </span>
                      {p.ready && (waiting || finished) ? (
                        <span className="text-[9px] font-display font-bold uppercase tracking-wider text-positive">
                          Ready
                        </span>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <LudoBoard
            seats={ludo.seats.filter((s) => Boolean(s.userId) || Boolean(s.isBot))}
            legalMoves={needMove ? legalMoves : []}
            mySeat={mySeat}
            disabled={!needMove}
            onMove={(tokenIndex) =>
              send({ type: 'ludo_move', ludoId, tokenIndex, seq: ludo.seq })
            }
          />
        </div>
      </div>

      {showWin && winner ? (
        <LudoWinModal
          winnerName={winner.name ?? ludoColorForSeat(winner.seat)}
          winnerSeat={winner.seat}
          youWon={winner.seat === mySeat}
          canReady={mySeat !== null}
          isReady={!!myPlayer?.ready}
          readyPlayers={readyPlayers}
          readyCount={readyHumans.length}
          readyTotal={Math.max(humans.length, 1)}
          onReady={() => send({ type: 'ludo_set_ready', ludoId, ready: !myPlayer?.ready })}
          onDismiss={() => setWinDismissed(true)}
        />
      ) : null}
    </TableShell>
  );
}
