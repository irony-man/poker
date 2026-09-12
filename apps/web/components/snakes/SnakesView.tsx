'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CopyRoomLink } from '@/components/CopyRoomLink';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PlayTableLogo } from '@/components/PlayTableLogo';
import { TableOverflowMenu, type OverflowItem } from '@/components/TableOverflowMenu';
import { TableShell } from '@/components/TableShell';
import { Button, buttonClass } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { MoveTimerStrip } from '@/components/TurnTimer';
import type { ReadyRosterPlayer } from '@/components/WinHandModal';
import type { SnakesPlayerView } from '@poker/protocol';
import { fetchSnakesChat } from '@/lib/api';
import { buildSnakesJoinShareText } from '@/lib/snakesLink';
import { snakesColorForSeat, snakesHexForSeat } from '@/lib/snakesBoard';
import { useIsNarrow } from '@/lib/tableLayout';
import { useSession } from '@/lib/store';
import { useSnakesSocket } from '@/lib/ws';
import { SnakesBoard } from './SnakesBoard';
import { SnakesWinModal } from './SnakesWinModal';

export function SnakesView({
  snakesId,
  inviteCode,
  initialSpectate = false,
}: {
  snakesId: string;
  inviteCode?: string | null;
  initialSpectate?: boolean;
}) {
  const router = useRouter();
  const narrow = useIsNarrow();
  const userId = useSession((s) => s.userId);
  const sessionToken = useSession((s) => s.sessionToken);
  const connection = useSession((s) => s.connection);
  const snakes = useSession((s) => s.snakes);
  const snakesYou = useSession((s) => s.snakesYou);
  const lastError = useSession((s) => s.lastError);
  const lastErrorCode = useSession((s) => s.lastErrorCode);
  const boundSnakesId = useSession((s) => s.boundSnakesId);
  const setError = useSession((s) => s.setError);
  const clearSnakes = useSession((s) => s.clearSnakes);
  const pushChat = useSession((s) => s.pushChat);
  const [chatOpen, setChatOpen] = useState(false);
  const [winDismissed, setWinDismissed] = useState(false);
  const [spectating, setSpectating] = useState(initialSpectate);
  const [rolling, setRolling] = useState(false);
  const prevSnakes = useRef<typeof snakes>(null);
  const { send, leaveSnakes } = useSnakesSocket(snakesId, { spectate: spectating });

  useEffect(() => {
    setWinDismissed(false);
  }, [snakes?.status, snakes?.winnerSeat]);

  useEffect(() => {
    let cancelled = false;
    void fetchSnakesChat(snakesId, sessionToken ? { sessionToken } : undefined)
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
  }, [snakesId, sessionToken, pushChat]);

  useEffect(() => {
    if (
      lastErrorCode !== 'not_found' &&
      lastErrorCode !== 'kicked' &&
      lastErrorCode !== 'account_deleted'
    ) {
      return;
    }
    if (boundSnakesId && boundSnakesId !== snakesId) return;
    leaveSnakes();
    clearSnakes();
    setError(null);
    router.replace('/');
  }, [lastErrorCode, boundSnakesId, snakesId, leaveSnakes, clearSnakes, setError, router]);

  const seats = useMemo<SnakesPlayerView[]>(() => {
    const max = snakes?.maxSeats ?? 4;
    const bySeat = new Map((snakes?.seats ?? []).map((s) => [s.seat, s]));
    return Array.from({ length: max }, (_, seat) => {
      return (
        bySeat.get(seat) ?? {
          seat,
          userId: null,
          name: null,
          isBot: false,
          ready: false,
          position: 0,
        }
      );
    });
  }, [snakes]);

  const mySeat =
    snakesYou?.seat ?? seats.find((s) => s.userId && s.userId === userId)?.seat ?? null;
  const myPlayer = mySeat !== null ? seats.find((s) => s.seat === mySeat) : undefined;
  const isSpectating = spectating && mySeat === null;
  const isHost = Boolean(snakes && userId && snakes.hostUserId === userId);
  const waiting = snakes?.status === 'waiting';
  const playing = snakes?.status === 'playing';
  const finished = snakes?.status === 'finished';
  const isMyTurn = playing && snakes?.toAct !== null && snakes?.toAct === mySeat;
  const needRoll = isMyTurn && snakes?.die == null;
  const emptySeats = seats.filter((s) => !s.userId).length;
  const botSeats = seats.filter((s) => s.isBot).length;
  const humans = seats.filter((s) => s.userId && !s.isBot);
  const readyHumans = humans.filter((s) => s.ready);
  const displayCode = inviteCode || snakes?.inviteCode || '';

  useEffect(() => {
    if (!rolling) return;
    if (snakes?.die != null || !isMyTurn || snakes?.status !== 'playing' || lastError) {
      setRolling(false);
    }
  }, [rolling, snakes?.die, snakes?.status, isMyTurn, lastError]);

  useEffect(() => {
    const prev = prevSnakes.current;
    prevSnakes.current = snakes;
    if (!snakes || !playing || !prev || prev.id !== snakes.id) return;

    const who = (seat: number) => {
      const p = snakes.seats.find((s) => s.seat === seat) ?? prev.seats.find((s) => s.seat === seat);
      if (!p) return snakesColorForSeat(seat);
      if (p.userId && p.userId === userId) return 'You';
      if (p.isBot) return p.name ?? 'Bot';
      return p.name ?? snakesColorForSeat(seat);
    };

    if (prev.die == null && snakes.die != null && prev.toAct != null) {
      let text = `${who(prev.toAct)} rolled ${snakes.die}`;
      if (snakes.lastFrom != null && snakes.lastTo != null) {
        text += ` · ${snakes.lastFrom}→${snakes.lastTo}`;
        if (snakes.lastTeleport != null) text += ` (teleport)`;
      }
      pushChat({ userId: 'system', name: 'Snakes', text, at: Date.now() });
    }
  }, [snakes, playing, userId, pushChat]);

  const readyPlayers: ReadyRosterPlayer[] = humans.map((p) => ({
    seat: p.seat,
    name: p.name ?? snakesColorForSeat(p.seat),
    userId: p.userId,
    avatarId: p.avatarId,
    avatarUrl: p.avatarUrl,
    ready: p.ready,
    isSelf: p.userId === userId,
  }));

  const leaveRoom = (to = '/') => {
    leaveSnakes();
    clearSnakes();
    setError(null);
    router.push(to);
  };

  const sitAt = (seat: number) => {
    setSpectating(false);
    send({ type: 'snakes_sit', snakesId, seat });
  };

  const sitFirstOpen = () => {
    const open = seats.find((s) => !s.userId);
    if (!open) return;
    sitAt(open.seat);
  };

  const winner =
    finished && snakes?.winnerSeat != null
      ? seats.find((s) => s.seat === snakes.winnerSeat)
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

  if (!snakes && (lastErrorCode === 'bad_auth' || connection === 'closed')) {
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

  if (!snakes) {
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
          void navigator.clipboard
            .writeText(buildSnakesJoinShareText(snakesId, displayCode))
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
        onClick: () => send({ type: 'snakes_add_bot', snakesId }),
      });
    }
    if (isHost && waiting && botSeats > 0) {
      const bot = seats.find((s) => s.isBot);
      if (bot) {
        mobileOverflowItems.push({
          id: 'remove-bot',
          label: 'Remove bot',
          onClick: () => send({ type: 'snakes_remove_bot', snakesId, seat: bot.seat }),
          tone: 'danger',
        });
      }
    }
    if (mySeat !== null && (waiting || finished)) {
      mobileOverflowItems.push({
        id: 'stand',
        label: 'Stand up',
        onClick: () => send({ type: 'snakes_stand', snakesId, seat: mySeat }),
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
        endsAt={playing ? snakes.turnEndsAt : null}
        totalMs={snakes.turnTimeMs ?? 20_000}
      />
      {lastError ? (
        <p className="text-center text-[11px] text-danger" role="alert">
          {lastError}
        </p>
      ) : null}
      {playing && needRoll ? (
        <p className="text-center text-[11px] font-display font-semibold uppercase tracking-wider text-ink-strong">
          Tap roll
        </p>
      ) : null}
      {playing && !isMyTurn ? (
        <p className="text-center text-[11px] text-ink-strong-muted">
          {snakes.toAct != null
            ? `${seats.find((s) => s.seat === snakes.toAct)?.name ?? snakesColorForSeat(snakes.toAct)} to act`
            : 'Waiting…'}
        </p>
      ) : null}
      {(waiting || finished) && mySeat !== null ? (
        <Button
          type="button"
          variant={myPlayer?.ready ? 'ghost' : 'primary'}
          className="min-h-11 w-full"
          onClick={() =>
            send({ type: 'snakes_set_ready', snakesId, ready: !myPlayer?.ready })
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
          onClick={() => send({ type: 'snakes_add_bot', snakesId })}
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
            if (bot) send({ type: 'snakes_remove_bot', snakesId, seat: bot.seat });
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
          onClick={() => send({ type: 'snakes_stand', snakesId, seat: mySeat })}
        >
          Stand up
        </Button>
      ) : null}
    </div>
  );

  return (
    <TableShell
      onSend={(text) => send({ type: 'snakes_chat', snakesId, text })}
      onEmoji={(emoji) => send({ type: 'snakes_chat', snakesId, text: emoji })}
      chatOpen={chatOpen}
      onChatOpenChange={setChatOpen}
      actionsExpanded={needRoll || rolling || waiting || finished || isSpectating || Boolean(lastError)}
      actions={actions}
      chatEmptyHint="Cheer a ladder or groan at a snake."
    >
      <div className="flex min-h-0 flex-1 flex-col bg-ink text-on-chrome">
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
                <CopyRoomLink tableId={snakesId} inviteCode={displayCode} compact kind="snakes" />
              ) : null}
              <TableOverflowMenu items={mobileOverflowItems} />
            </div>
          ) : (
            <div className="play-chrome-rail">
              {displayCode ? (
                <CopyRoomLink tableId={snakesId} inviteCode={displayCode} kind="snakes" />
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
            {snakes.die != null && !rolling ? (
              <StatusChip tone="playBrass" className="tabular-nums">
                Rolled {snakes.die}
              </StatusChip>
            ) : rolling ? (
              <StatusChip tone="playMuted">Rolling…</StatusChip>
            ) : null}
            {waiting || finished ? (
              <StatusChip tone="playMuted" className="tabular-nums">
                Ready {readyHumans.length}/{Math.max(humans.length, 1)}
              </StatusChip>
            ) : null}
            {playing && snakes.toAct != null ? (
              <StatusChip tone="playPositive">
                {snakes.toAct === mySeat
                  ? 'Your turn'
                  : `${seats.find((s) => s.seat === snakes.toAct)?.name ?? snakesColorForSeat(snakes.toAct)}`}
              </StatusChip>
            ) : null}
          </div>

          <ul className="flex flex-wrap gap-2 px-0.5">
            {seats.map((p) => {
              const color = snakesColorForSeat(p.seat);
              const hex = snakesHexForSeat(p.seat);
              const empty = !p.userId;
              const toAct = playing && snakes.toAct === p.seat;
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
                        toAct ? 'border-brass/60 bg-brass/20' : 'border-white/25 bg-white/10'
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
                      {playing || finished ? (
                        <span className="tabular-nums text-[10px] text-on-chrome/70">
                          {p.position}
                        </span>
                      ) : null}
                      {p.ready && (waiting || finished) ? (
                        <span className="rounded-sm bg-emerald-400/20 px-1 py-px text-[9px] font-display font-bold uppercase tracking-wider text-emerald-300">
                          Ready
                        </span>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <SnakesBoard
            seats={snakes.seats.filter((s) => Boolean(s.userId) || Boolean(s.isBot))}
            lastFrom={snakes.lastFrom}
            lastTo={snakes.lastTo}
            lastTeleport={snakes.lastTeleport}
            die={playing ? snakes.die : null}
            canRoll={needRoll}
            rolling={rolling}
            onRoll={() => {
              if (!snakes || rolling || !needRoll) return;
              setRolling(true);
              send({ type: 'snakes_roll', snakesId, seq: snakes.seq });
            }}
          />
        </div>
      </div>

      {showWin && winner ? (
        <SnakesWinModal
          winnerName={winner.name ?? snakesColorForSeat(winner.seat)}
          winnerSeat={winner.seat}
          youWon={winner.seat === mySeat}
          canReady={mySeat !== null}
          isReady={!!myPlayer?.ready}
          readyPlayers={readyPlayers}
          readyCount={readyHumans.length}
          readyTotal={Math.max(humans.length, 1)}
          onReady={() =>
            send({ type: 'snakes_set_ready', snakesId, ready: !myPlayer?.ready })
          }
          onDismiss={() => setWinDismissed(true)}
        />
      ) : null}
    </TableShell>
  );
}
