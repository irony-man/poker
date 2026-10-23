'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  applyAction,
  applyTimeout,
  chooseBotAction,
  createEmptyTable,
  isBotUserId,
  makeBotUserId,
  pickBotName,
  returnToWaiting,
  sitDown,
  startHand,
  toPrivateView,
  toPublicView,
  type HandState,
  type TableConfig,
} from '@poker/engine';
import { loadSavedTableColorId } from '@/lib/tableColors';
import { useSfxMuted } from '@/lib/useSfxMuted';
import { useTableHotkeys, type PlayHotkeyHandlers } from '@/lib/useTableHotkeys';
import { useTableLayout } from '@/lib/useTableLayout';
import { loadOfflineSession } from '@/lib/offlineSession';
import { PkButton } from '../Button';
import { PkDialog } from '../Overlay';
import { PkScope } from '../PkScope';
import { PkTableChrome, type PkTableModel } from './PkTableChrome';

const HUMAN_ID = 'offline-human';

export function PkOfflineTable({
  config,
  playerName,
  botNames,
  resume = false,
}: {
  config: TableConfig;
  playerName: string;
  botNames?: readonly string[];
  resume?: boolean;
}) {
  const router = useRouter();
  const layout = useTableLayout();
  const { muted, setMuted } = useSfxMuted();
  const playHotkeysRef = useRef<PlayHotkeyHandlers | null>(null);
  const [colorId, setColorId] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [chat, setChat] = useState<{ name: string; text: string }[]>([]);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [state, setState] = useState<HandState>(() => {
    if (resume) {
      const saved = loadOfflineSession();
      if (saved) return saved.state;
    }
    return seatTable(createEmptyTable(config), config, playerName, botNames);
  });

  useTableHotkeys({
    enabled: true,
    playRef: playHotkeysRef,
    chrome: { help: () => setHelpOpen(true), sfxMute: () => setMuted(!muted) },
  });
  useEffect(() => setColorId(loadSavedTableColorId()), []);

  useEffect(() => {
    const actor = state.toAct;
    if (actor == null) return;
    const player = state.players[actor];
    if (!player?.userId) return;
    const ends = Date.now() + config.turnTimeMs;
    setTurnEndsAt(ends);
    if (!isBotUserId(player.userId)) {
      const timer = window.setTimeout(() => {
        setState((current) => applyTimeout(current, config).state);
      }, config.turnTimeMs);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.toAct !== actor) return current;
        const intent = chooseBotAction(current, actor, config);
        if (!intent) return current;
        const result = applyAction(current, actor, intent, config);
        return result.ok ? result.state : current;
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [state.actionSeq, state.toAct, state.street, config]);

  const pub = toPublicView('offline', state, config);
  const priv = toPrivateView(state, 0, config);
  const model: PkTableModel = useMemo(
    () => ({
      maxSeats: config.maxSeats,
      players: pub.players.map((player) => ({
        seat: player.seat,
        userId: player.userId,
        name: player.name,
        stack: player.stack,
        bet: player.bet,
        status: player.status,
        holeCards: player.holeCards,
      })),
      community: pub.community,
      pot: pub.pot,
      sidePots: pub.sidePots,
      street: pub.street,
      dealerButton: pub.dealerButton,
      sbSeat: pub.sbSeat,
      bbSeat: pub.bbSeat,
      toAct: pub.toAct,
      heroSeat: 0,
      holeCards: priv.holeCards,
      legal: pub.toAct === 0 ? priv.legal : null,
      turnEndsAt,
      turnTotalMs: config.turnTimeMs,
      connection: 'open',
      spectating: false,
      lobby: pub.street === 'waiting' && !pub.handId,
      guest: false,
      bigBlind: config.bigBlind,
      currentBet: pub.currentBet,
      tableColorId: colorId,
      layout,
    }),
    [pub, priv, config, turnEndsAt, colorId, layout],
  );

  function onAction(action: string, amount?: number) {
    setState((current) => {
      if (current.toAct !== 0) return current;
      const result = applyAction(
        current,
        0,
        { type: action as 'fold', amount, seq: current.actionSeq },
        config,
      );
      return result.ok ? result.state : current;
    });
  }

  const showWin = state.street === 'payout' || state.street === 'showdown';

  return (
    <PkScope>
      <PkTableChrome
        model={model}
        title="Offline table"
        onAction={onAction}
        onLeave={() => router.push('/solo')}
        playHotkeysRef={playHotkeysRef}
        chat={chat}
        onChat={(text) => setChat((prev) => [...prev, { name: playerName, text }])}
        onEmoji={(emoji) => setChat((prev) => [...prev, { name: playerName, text: emoji }])}
        helpOpen={helpOpen}
        onHelp={setHelpOpen}
        muted={muted}
        onToggleMute={() => setMuted(!muted)}
        tools={
          state.street === 'waiting' ? (
            <PkButton
              onClick={() =>
                setState((current) => {
                  const started = startHand(current, config, `off-${Date.now()}`, (n) => crypto.getRandomValues(new Uint8Array(n)));
                  return started.ok ? started.state : current;
                })
              }
            >
              Start hand
            </PkButton>
          ) : null
        }
      />
      <PkDialog
        open={showWin}
        title="Hand complete"
        onClose={() => setState((current) => returnToWaiting(current))}
      >
        <p className="text-pk-body-md">
          {state.winners.map((winner) => `Seat ${winner.seat + 1} wins ${winner.amount}`).join(' · ') || 'Next hand'}
        </p>
        <PkButton className="mt-pk-4" onClick={() => setState((current) => returnToWaiting(current))}>
          Next hand
        </PkButton>
      </PkDialog>
    </PkScope>
  );
}

function seatTable(
  empty: HandState,
  config: TableConfig,
  playerName: string,
  botNames?: readonly string[],
): HandState {
  let state = sitDown(empty, 0, HUMAN_ID, playerName, config.buyIn).state;
  const taken = new Set<string>([playerName]);
  for (let seat = 1; seat < config.maxSeats; seat += 1) {
    const name = pickBotName(taken, botNames);
    taken.add(name);
    const sat = sitDown(state, seat, makeBotUserId(`${seat}-${name}`), name, config.buyIn);
    if (sat.ok) state = sat.state;
  }
  return state;
}
