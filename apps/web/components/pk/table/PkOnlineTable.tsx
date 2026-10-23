'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHandPresentation } from '@/hooks/useHandPresentation';
import { useTableSounds } from '@/hooks/useTableSounds';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { loadSavedTableColorId } from '@/lib/tableColors';
import { useTableLayout } from '@/lib/useTableLayout';
import { useSfxMuted } from '@/lib/useSfxMuted';
import { useTableHotkeys, type PlayHotkeyHandlers } from '@/lib/useTableHotkeys';
import { usePokerSocket, sessionSocketSend } from '@/lib/ws';
import { useSession } from '@/lib/store';
import { fetchPublicBotGroups, type PublicBotGroup } from '@/lib/api';
import { PkButton } from '../Button';
import { PkDialog } from '../Overlay';
import { PkScope } from '../PkScope';
import { pkToast } from '../Bits';
import { PkTableChrome, type PkTableModel } from './PkTableChrome';

export function PkOnlineTable({
  tableId,
  inviteCode,
  initialSpectate = false,
}: {
  tableId: string;
  inviteCode?: string | null;
  initialSpectate?: boolean;
}) {
  const router = useRouter();
  const table = useSession((s) => s.table);
  const priv = useSession((s) => s.private);
  const userId = useSession((s) => s.userId);
  const connection = useSession((s) => s.connection);
  const chat = useSession((s) => s.chat);
  const setError = useSession((s) => s.setError);
  const clearTable = useSession((s) => s.clearTable);
  const { send, leaveTable } = usePokerSocket(tableId, { spectate: initialSpectate });
  const voice = useVoiceCall(tableId, userId, send);
  const layout = useTableLayout();
  const { muted, setMuted } = useSfxMuted();
  const playHotkeysRef = useRef<PlayHotkeyHandlers | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [colorId, setColorId] = useState(0);
  const [groups, setGroups] = useState<PublicBotGroup[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  useTableSounds(table);
  useTableHotkeys({ enabled: true, playRef: playHotkeysRef, chrome: { help: () => setHelpOpen(true), sfxMute: () => setMuted(!muted) } });

  useEffect(() => setColorId(loadSavedTableColorId()), []);
  useEffect(() => {
    void fetchPublicBotGroups().then((next) => {
      setGroups(next);
      setGroupId(next.find((group) => group.isDefault)?.id ?? next[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      sessionSocketSend({
        type: 'join_table',
        tableId,
        ...(initialSpectate ? { spectate: true } : {}),
      });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [tableId, initialSpectate]);

  const mySeat = table?.players.find((player) => player.userId === userId)?.seat;
  const presentation = useHandPresentation(table, userId, dismissed, priv?.holeCards);
  const model: PkTableModel | null = useMemo(() => {
    if (!table) return null;
    return {
      maxSeats: table.config.maxSeats,
      players: table.players.map((player) => ({
        seat: player.seat,
        userId: player.userId,
        name: player.name,
        stack: player.stack,
        bet: player.bet,
        status: player.status,
        holeCards: player.holeCards,
        avatarId: player.avatarId,
      })),
      community: table.community,
      pot: table.pot,
      sidePots: table.sidePots ?? [],
      street: table.street,
      dealerButton: table.dealerButton,
      sbSeat: table.sbSeat,
      bbSeat: table.bbSeat,
      toAct: table.toAct,
      heroSeat: mySeat,
      holeCards: priv?.holeCards ?? null,
      legal: online && connection === 'open' ? priv?.legal ?? null : null,
      turnEndsAt: table.turnEndsAt ?? null,
      turnTotalMs: table.config.turnTimeMs,
      connection: online ? connection : 'closed',
      spectating: initialSpectate && mySeat === undefined,
      lobby: table.lobby === true,
      guest: !userId,
      bigBlind: table.config.bigBlind,
      currentBet: table.currentBet,
      tableColorId: colorId,
      layout,
    };
  }, [table, priv, mySeat, connection, online, initialSpectate, userId, colorId, layout]);

  function onAction(action: string, amount?: number) {
    if (!table || !online || connection !== 'open') {
      setError('Disconnected — wait for reconnect, then try again');
      pkToast('error', 'Disconnected — wait for reconnect, then try again');
      return;
    }
    const ok = send({ type: 'action', tableId, handId: table.handId, seq: table.actionSeq, action, amount });
    if (!ok) pkToast('error', 'Could not send action — connection lost');
  }

  function leave() {
    voice.leaveVoice();
    leaveTable();
    clearTable();
    router.push('/');
  }

  if (!model || !table) {
    return (
      <PkScope>
        <p className="p-pk-6">Joining table…</p>
      </PkScope>
    );
  }

  const isHost = !!userId && table.hostUserId === userId;

  return (
    <PkScope>
      <PkTableChrome
        model={model}
        title={table.name ?? 'Table'}
        onAction={onAction}
        onLeave={() => setLeaveOpen(true)}
        playHotkeysRef={playHotkeysRef}
        chat={chat.map((message) => ({ name: message.name, text: message.text }))}
        onChat={(text) => send({ type: 'chat', tableId, text })}
        onEmoji={(emoji) => send({ type: 'emoji', tableId, emoji })}
        helpOpen={helpOpen}
        onHelp={setHelpOpen}
        muted={muted}
        onToggleMute={() => setMuted(!muted)}
        voice={
          <PkButton variant="ghost" onClick={() => (voice.inVoice ? voice.leaveVoice() : voice.joinVoice())}>
            {voice.inVoice ? 'Leave voice' : 'Voice'}
          </PkButton>
        }
        tools={
          <div className="flex flex-wrap justify-center gap-pk-2">
            {table.lobby && isHost ? (
              <PkButton onClick={() => send({ type: 'start_game', tableId })}>Start</PkButton>
            ) : null}
            {table.lobby && isHost ? (
              <PkButton
                variant="secondary"
                onClick={() =>
                  send({
                    type: 'add_bot',
                    tableId,
                    buyIn: table.config.buyIn,
                    count: 1,
                    ...(groupId ? { botGroupId: groupId } : {}),
                  })
                }
              >
                Add bot{groups.length ? '' : ''}
              </PkButton>
            ) : null}
            {mySeat != null && table.street !== 'waiting' ? (
              <PkButton variant="ghost" onClick={() => send({ type: 'sit_out', tableId, seat: mySeat })}>
                Sit out
              </PkButton>
            ) : null}
            {mySeat != null ? (
              <PkButton variant="ghost" onClick={() => send({ type: 'sit_in', tableId, seat: mySeat })}>
                Sit in
              </PkButton>
            ) : null}
            {mySeat != null ? (
              <PkButton
                variant="secondary"
                onClick={() => send({ type: 'top_up', tableId, seat: mySeat, amount: table.config.buyIn })}
              >
                Top up
              </PkButton>
            ) : null}
            {inviteCode ? <p className="w-full text-center text-pk-caption">Code {inviteCode}</p> : null}
          </div>
        }
      />
      <PkDialog
        open={presentation.showWinModal}
        title={presentation.youWon ? 'You won the hand' : 'Hand complete'}
        onClose={() => setDismissed(table.handId)}
      >
        <ul className="space-y-pk-2 text-pk-body-md">
          {presentation.winLines.map((line) => (
            <li key={line.seat}>
              {line.name} {line.amount >= 0 ? '+' : ''}
              {line.amount}
              {line.handName ? ` · ${line.handName}` : ''}
            </li>
          ))}
        </ul>
        <PkButton className="mt-pk-4" onClick={() => setDismissed(table.handId)}>
          Continue
        </PkButton>
      </PkDialog>
      <PkDialog open={leaveOpen} title="Leave this table?" onClose={() => setLeaveOpen(false)}>
        <p className="text-pk-body-md text-muted">Your remaining stack returns to your bankroll between hands.</p>
        <div className="mt-pk-4 flex justify-end gap-pk-2">
          <PkButton variant="ghost" onClick={() => setLeaveOpen(false)}>
            Stay
          </PkButton>
          <PkButton variant="danger" onClick={leave}>
            Leave
          </PkButton>
        </div>
      </PkDialog>
    </PkScope>
  );
}
