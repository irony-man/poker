'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CopyRoomLink } from '@/components/CopyRoomLink';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { PlayTableLogo } from '@/components/PlayTableLogo';
import { TableOverflowMenu, type OverflowItem } from '@/components/TableOverflowMenu';
import { TableShell } from '@/components/TableShell';
import { Button, buttonClass } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { MoveTimerStrip } from '@/components/TurnTimer';
import type { ReadyRosterPlayer } from '@/components/WinHandModal';
import type { MemoryPlayerView } from '@poker/protocol';
import { fetchMemoryChat } from '@/lib/api';
import { buildMemoryJoinShareText } from '@/lib/memoryLink';
import { ludoColorForSeat, ludoHexForSeat } from '@/lib/ludoBoard';
import { useIsNarrow } from '@/lib/tableLayout';
import { useSession } from '@/lib/store';
import { useMemorySocket } from '@/lib/ws';
import { MemoryBoard } from './MemoryBoard';
import { MemoryWinModal } from './MemoryWinModal';

export function MemoryView({
  memoryId,
  inviteCode,
  initialSpectate = false,
}: {
  memoryId: string;
  inviteCode?: string | null;
  initialSpectate?: boolean;
}) {
  const router = useRouter();
  const narrow = useIsNarrow();
  const userId = useSession((s) => s.userId);
  const sessionToken = useSession((s) => s.sessionToken);
  const connection = useSession((s) => s.connection);
  const memory = useSession((s) => s.memory);
  const memoryYou = useSession((s) => s.memoryYou);
  const lastError = useSession((s) => s.lastError);
  const lastErrorCode = useSession((s) => s.lastErrorCode);
  const boundMemoryId = useSession((s) => s.boundMemoryId);
  const setError = useSession((s) => s.setError);
  const clearMemory = useSession((s) => s.clearMemory);
  const pushChat = useSession((s) => s.pushChat);
  const [chatOpen, setChatOpen] = useState(false);
  const [winDismissed, setWinDismissed] = useState(false);
  const [spectating, setSpectating] = useState(initialSpectate);
  const { send, leaveMemory } = useMemorySocket(memoryId, { spectate: spectating });

  useEffect(() => {
    setWinDismissed(false);
  }, [memory?.status, memory?.winnerSeats?.join(',')]);

  useEffect(() => {
    let cancelled = false;
    void fetchMemoryChat(memoryId, sessionToken ? { sessionToken } : undefined)
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
  }, [memoryId, sessionToken, pushChat]);

  useEffect(() => {
    if (
      lastErrorCode !== 'not_found' &&
      lastErrorCode !== 'kicked' &&
      lastErrorCode !== 'account_deleted'
    ) {
      return;
    }
    if (boundMemoryId && boundMemoryId !== memoryId) return;
    leaveMemory();
    clearMemory();
    setError(null);
    router.replace('/');
  }, [lastErrorCode, boundMemoryId, memoryId, leaveMemory, clearMemory, setError, router]);

  const seats = useMemo<MemoryPlayerView[]>(() => {
    const max = memory?.maxSeats ?? 2;
    const bySeat = new Map((memory?.seats ?? []).map((s) => [s.seat, s]));
    return Array.from({ length: max }, (_, seat) => {
      return (
        bySeat.get(seat) ?? {
          seat,
          userId: null,
          name: null,
          isBot: false,
          ready: false,
          pairs: 0,
        }
      );
    });
  }, [memory]);

  const mySeat =
    memoryYou?.seat ?? seats.find((s) => s.userId && s.userId === userId)?.seat ?? null;
  const myPlayer = mySeat !== null ? seats.find((s) => s.seat === mySeat) : undefined;
  const isSpectating = spectating && mySeat === null;
  const isHost = Boolean(memory && userId && memory.hostUserId === userId);
  const waiting = memory?.status === 'waiting';
  const playing = memory?.status === 'playing';
  const finished = memory?.status === 'finished';
  const isMyTurn = playing && memory?.toAct !== null && memory?.toAct === mySeat;
  const canFlip = isMyTurn && (memory?.faceUp?.length ?? 0) < 2;
  const emptySeats = seats.filter((s) => !s.userId).length;
  const botSeats = seats.filter((s) => s.isBot).length;
  const humans = seats.filter((s) => s.userId && !s.isBot);
  const readyHumans = humans.filter((s) => s.ready);
  const displayCode = inviteCode || memory?.inviteCode || '';
  const winnerSeats = memory?.winnerSeats ?? [];
  const winners = winnerSeats
    .map((seat) => {
      const p = seats.find((s) => s.seat === seat);
      if (!p) return null;
      return {
        name: p.name ?? ludoColorForSeat(seat),
        seat,
        isSelf: p.userId === userId,
      };
    })
    .filter((w): w is NonNullable<typeof w> => w != null);
  const youWon = winners.some((w) => w.isSelf);
  const showWin = Boolean(finished && winners.length > 0 && !winDismissed);

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
    leaveMemory();
    clearMemory();
    setError(null);
    router.push(to);
  };

  const sitAt = (seat: number) => {
    setSpectating(false);
    send({ type: 'memory_sit', memoryId, seat });
  };

  const sitFirstOpen = () => {
    const open = seats.find((s) => !s.userId);
    if (!open) return;
    sitAt(open.seat);
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

  if (!memory && (lastErrorCode === 'bad_auth' || connection === 'closed')) {
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

  if (!memory) {
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
            .writeText(buildMemoryJoinShareText(memoryId, displayCode))
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
        onClick: () => send({ type: 'memory_add_bot', memoryId }),
      });
    }
    if (isHost && waiting && botSeats > 0) {
      const bot = seats.find((s) => s.isBot);
      if (bot) {
        mobileOverflowItems.push({
          id: 'remove-bot',
          label: 'Remove bot',
          onClick: () => send({ type: 'memory_remove_bot', memoryId, seat: bot.seat }),
          tone: 'danger',
        });
      }
    }
    if (mySeat !== null && (waiting || finished)) {
      mobileOverflowItems.push({
        id: 'stand',
        label: 'Stand up',
        onClick: () => send({ type: 'memory_stand', memoryId, seat: mySeat }),
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
        endsAt={playing ? memory.turnEndsAt : null}
        totalMs={memory.turnTimeMs ?? 20_000}
      />
      {lastError ? (
        <p className="text-center text-[11px] text-danger" role="alert">
          {lastError}
        </p>
      ) : null}
      {playing && isMyTurn ? (
        <p className="text-center text-[11px] font-display font-semibold uppercase tracking-wider text-primary">
          Flip a card
        </p>
      ) : null}
      {playing && !isMyTurn ? (
        <p className="text-center text-[11px] text-muted">
          {memory.toAct != null
            ? `${seats.find((s) => s.seat === memory.toAct)?.name ?? ludoColorForSeat(memory.toAct)} to act`
            : 'Waiting…'}
        </p>
      ) : null}
      {(waiting || finished) && mySeat !== null ? (
        <Button
          type="button"
          variant={myPlayer?.ready ? 'ghost' : 'primary'}
          className="min-h-11 w-full"
          onClick={() =>
            send({ type: 'memory_set_ready', memoryId, ready: !myPlayer?.ready })
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
          onClick={() => send({ type: 'memory_add_bot', memoryId })}
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
            if (bot) send({ type: 'memory_remove_bot', memoryId, seat: bot.seat });
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
          onClick={() => send({ type: 'memory_stand', memoryId, seat: mySeat })}
        >
          Stand up
        </Button>
      ) : null}
    </div>
  );

  return (
    <TableShell
      onSend={(text) => send({ type: 'memory_chat', memoryId, text })}
      onEmoji={(emoji) => send({ type: 'memory_chat', memoryId, text: emoji })}
      chatOpen={chatOpen}
      onChatOpenChange={setChatOpen}
      actionsExpanded={canFlip || waiting || finished || isSpectating || Boolean(lastError)}
      actions={actions}
      chatEmptyHint="Call out a match or tease a miss."
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
                <CopyRoomLink tableId={memoryId} inviteCode={displayCode} compact kind="memory" />
              ) : null}
              <TableOverflowMenu items={mobileOverflowItems} />
            </div>
          ) : (
            <div className="play-chrome-rail">
              {displayCode ? (
                <CopyRoomLink tableId={memoryId} inviteCode={displayCode} kind="memory" />
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
            <StatusChip tone="playMuted">
              {memory.gridSize === 36 ? '6×6' : '4×4'}
            </StatusChip>
            {waiting || finished ? (
              <StatusChip tone="playMuted" className="tabular-nums">
                Ready {readyHumans.length}/{Math.max(humans.length, 1)}
              </StatusChip>
            ) : null}
            {playing && memory.toAct != null ? (
              <StatusChip tone="playPositive">
                {memory.toAct === mySeat
                  ? 'Your turn'
                  : `${seats.find((s) => s.seat === memory.toAct)?.name ?? ludoColorForSeat(memory.toAct)}`}
              </StatusChip>
            ) : null}
          </div>

          <ul className="flex flex-wrap gap-2 px-0.5">
            {seats.map((p) => {
              const color = ludoColorForSeat(p.seat);
              const hex = ludoHexForSeat(p.seat);
              const empty = !p.userId;
              const toAct = playing && memory.toAct === p.seat;
              return (
                <li key={p.seat}>
                  {empty ? (
                    <button
                      type="button"
                      disabled={mySeat !== null && !isSpectating}
                      onClick={() => sitAt(p.seat)}
                      className="flex items-center gap-1.5 rounded-full border border-on-chrome/20 bg-raised px-2.5 py-1 text-[11px] text-on-chrome/80 hover:border-on-chrome/40 disabled:opacity-50"
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
                      {(playing || finished) && (
                        <span className="tabular-nums text-[10px] text-on-chrome/70">
                          {p.pairs}p
                        </span>
                      )}
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

          <MemoryBoard
            cards={memory.cards}
            gridSize={memory.gridSize}
            canFlip={canFlip}
            onFlip={(index) =>
              send({ type: 'memory_flip', memoryId, index, seq: memory.seq })
            }
          />
        </div>
      </div>

      {showWin ? (
        <MemoryWinModal
          winners={winners}
          youWon={youWon}
          canReady={mySeat !== null}
          isReady={!!myPlayer?.ready}
          readyPlayers={readyPlayers}
          readyCount={readyHumans.length}
          readyTotal={Math.max(humans.length, 1)}
          onReady={() =>
            send({ type: 'memory_set_ready', memoryId, ready: !myPlayer?.ready })
          }
          onDismiss={() => setWinDismissed(true)}
        />
      ) : null}
    </TableShell>
  );
}
