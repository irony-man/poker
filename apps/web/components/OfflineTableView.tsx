'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  applyAction,
  applyTimeout,
  cardToString,
  chooseBotAction,
  createEmptyTable,
  isBotUserId,
  makeBotUserId,
  pickBotName,
  resolveBotPersonalityId,
  returnToWaiting,
  sitDown,
  sitIn,
  sitOut,
  startHand,
  topUp,
  toPrivateView,
  toPublicView,
  type BotStyleOptions,
  type EngineEvent,
  type HandState,
  type TableConfig,
} from '@poker/engine';
import { ActionControls } from './ActionControls';
import { CommunityBoard } from './CommunityBoard';
import { DealerPotZone } from './DealerPotZone';
import { SeatView } from './SeatView';
import { HowToPlayHelp } from './HowToPlayHelp';
import { isSeatActionLabel } from '@/lib/seatAction';
import { TableOverflowMenu, type OverflowItem } from './TableOverflowMenu';
import { TableShell } from './TableShell';
import { Button, buttonClass } from '@/components/ui/Button';
import { WinHandModal } from './WinHandModal';
import { avatarIdFromUserId, loadSavedAvatarId } from '@/lib/avatars';
import { loadSavedTableColorId } from '@/lib/tableColors';
import { coerceMoney, formatMoneyAmount } from '@/lib/currency';
import { useHandPresentation } from '@/hooks/useHandPresentation';
import { useTableSounds } from '@/hooks/useTableSounds';
import { useSession, type ChatMessage, type PrivateView, type PublicTable } from '@/lib/store';
import { seatAnglesForHero, useIsLandscapePhone, useIsNarrow } from '@/lib/tableLayout';
import {
  buildOfflineHandResult,
  flushOfflineHandQueue,
  newOfflineTableId,
  submitOfflineHand,
} from '@/lib/offlineHandHistory';
import { readStoredSession } from '@/lib/session';
import type { ActionType } from '@poker/engine';

const HUMAN_ID = 'offline-human';
const BOT_READY_DELAY_MIN_MS = 400;
const BOT_READY_DELAY_RANGE_MS = 1200;

function eligibleForNextHand(p: {
  userId?: string | null;
  stack: number;
  status: string;
}): boolean {
  return (
    !!p.userId &&
    coerceMoney(p.stack) > 0 &&
    p.status !== 'sittingOut' &&
    p.status !== 'empty'
  );
}

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

function formatAction(action: string, amount: number): string {
  switch (action) {
    case 'fold':
      return 'folds';
    case 'check':
      return 'checks';
    case 'call':
      return `calls ${formatMoneyAmount(amount)}`;
    case 'bet':
      return `bets ${formatMoneyAmount(amount)}`;
    case 'raise':
      return `raises to ${formatMoneyAmount(amount)}`;
    case 'allin':
      return amount > 0 ? `goes all-in (${formatMoneyAmount(amount)})` : 'goes all-in';
    default:
      return action;
  }
}

function formatActionPopup(action: string, amount: number): string {
  switch (action) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return `Call ${formatMoneyAmount(amount)}`;
    case 'bet':
      return `Bet ${formatMoneyAmount(amount)}`;
    case 'raise':
      return `Raise ${formatMoneyAmount(amount)}`;
    case 'allin':
      return amount > 0 ? `All-in ${formatMoneyAmount(amount)}` : 'All-in';
    default:
      return action;
  }
}

function announceEvents(
  state: HandState,
  events: EngineEvent[],
  push: (m: ChatMessage) => void,
  onSeatAction?: (seat: number, label: string, action: ActionType) => void,
) {
  for (const e of events) {
    if (e.type === 'action') {
      const name = state.players[e.seat]?.name ?? `Seat ${e.seat}`;
      push({ userId: 'system', name, text: formatAction(e.action, e.amount), at: Date.now() });
      onSeatAction?.(e.seat, formatActionPopup(e.action, e.amount), e.action);
    } else if (e.type === 'street') {
      const label = e.street.charAt(0).toUpperCase() + e.street.slice(1);
      push({
        userId: 'system',
        name: 'Dealer',
        text: `${label} — ${e.cards.map(cardToString).join(' ')}`,
        at: Date.now(),
      });
    } else if (e.type === 'hand_ended') {
      if (e.winners.length === 1) {
        const w = e.winners[0]!;
        const name = state.players[w.seat]?.name ?? `Seat ${w.seat}`;
        const hand =
          w.handName && w.handName !== 'Uncontested' ? ` with ${w.handName}` : '';
        push({
          userId: 'system',
          name: 'Dealer',
          text: `${name} wins ${formatMoneyAmount(w.amount)}${hand}`,
          at: Date.now(),
        });
      } else if (e.winners.length > 1) {
        const parts = e.winners.map((w) => {
          const name = state.players[w.seat]?.name ?? `Seat ${w.seat}`;
          const hand =
            w.handName && w.handName !== 'Uncontested' ? ` (${w.handName})` : '';
          return `${name} ${formatMoneyAmount(w.amount)}${hand}`;
        });
        push({
          userId: 'system',
          name: 'Dealer',
          text: `Split pot — ${parts.join(', ')}`,
          at: Date.now(),
        });
      }
    } else if (e.type === 'blinds_posted') {
      const sb = state.players[e.sbSeat]?.name ?? 'SB';
      const bb = state.players[e.bbSeat]?.name ?? 'BB';
      push({
        userId: 'system',
        name: 'Dealer',
        text: `Blinds — ${sb} posts ${formatMoneyAmount(e.sb)}, ${bb} posts ${formatMoneyAmount(e.bb)}`,
        at: Date.now(),
      });
    }
  }
}

export function OfflineTableView({
  config,
  playerName,
  botNames,
  botStyles,
}: {
  config: TableConfig;
  playerName: string;
  /** Admin bot group names; falls back to built-in engine defaults. */
  botNames?: readonly string[];
  /** Admin bot group styles (group default + per-name). */
  botStyles?: BotStyleOptions | null;
}) {
  const pushChat = useSession((s) => s.pushChat);
  const setEmoji = useSession((s) => s.setEmoji);
  const setActionBurst = useSession((s) => s.setActionBurst);
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();

  const [state, setState] = useState<HandState>(() => createEmptyTable(config));
  const [bootstrapped, setBootstrapped] = useState(false);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [dismissedWinHandId, setDismissedWinHandId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [tableColorId, setTableColorId] = useState(0);

  useEffect(() => {
    setTableColorId(loadSavedTableColorId());
  }, []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botReadyTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const botReadyIdsRef = useRef<Set<string>>(new Set());
  const [botReadyVersion, setBotReadyVersion] = useState(0);
  const tableIdRef = useRef(newOfflineTableId(readStoredSession()?.userId));
  const handStartedAtRef = useRef(0);
  const handActionsRef = useRef<Array<EngineEvent & { at: number }>>([]);
  const handChatRef = useRef<ChatMessage[]>([]);
  const recordedHandsRef = useRef(new Set<string>());

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTurnEndsAt(null);
  };

  const clearBotReadyTimers = useCallback(() => {
    for (const timer of botReadyTimersRef.current.values()) clearTimeout(timer);
    botReadyTimersRef.current.clear();
  }, []);

  const resetBotReady = useCallback(() => {
    clearBotReadyTimers();
    botReadyIdsRef.current.clear();
    setBotReadyVersion((v) => v + 1);
  }, [clearBotReadyTimers]);

  const scheduleBotAutoReady = useCallback((s: HandState) => {
    if (s.street !== 'waiting' && s.street !== 'payout') return;

    for (const p of s.players) {
      if (!p.userId || !isBotUserId(p.userId) || !eligibleForNextHand(p)) continue;
      const uid = p.userId;
      if (botReadyIdsRef.current.has(uid) || botReadyTimersRef.current.has(uid)) continue;

      const delay = BOT_READY_DELAY_MIN_MS + Math.floor(Math.random() * BOT_READY_DELAY_RANGE_MS);
      const timer = setTimeout(() => {
        botReadyTimersRef.current.delete(uid);
        botReadyIdsRef.current.add(uid);
        setBotReadyVersion((v) => v + 1);
      }, delay);
      botReadyTimersRef.current.set(uid, timer);
    }
  }, []);

  const recordChat = useCallback(
    (m: ChatMessage) => {
      handChatRef.current.push(m);
      pushChat(m);
    },
    [pushChat],
  );

  const persistCompletedHand = useCallback((next: HandState) => {
    if (!next.handId || recordedHandsRef.current.has(next.handId)) return;
    if (!readStoredSession()?.sessionToken) return;
    recordedHandsRef.current.add(next.handId);
    const payload = {
      tableId: tableIdRef.current,
      handId: next.handId,
      startedAt: handStartedAtRef.current || Date.now(),
      endedAt: Date.now(),
      source: 'offline' as const,
      result: buildOfflineHandResult(next, handActionsRef.current, handChatRef.current),
      chat: handChatRef.current,
    };
    void submitOfflineHand(payload);
  }, []);

  const syncChat = useCallback(
    (next: HandState, events: EngineEvent[]) => {
      const at = Date.now();
      for (const e of events) handActionsRef.current.push({ ...e, at });
      announceEvents(next, events, recordChat, (seat, label, action) => {
        if (!isSeatActionLabel(label)) return;
        setActionBurst({ seat, label, at: Date.now(), action });
      });
      if (events.some((e) => e.type === 'hand_ended') || next.street === 'payout') {
        persistCompletedHand(next);
      }
    },
    [recordChat, setActionBurst, persistCompletedHand],
  );

  // Seed human + bots once.
  // Do not touch ticket/sessionToken — a fake "offline" ticket makes the
  // app-level WebSocket re-auth and the server answers "Invalid or expired ticket".
  useEffect(() => {
    const prior = useSession.getState();
    const restore = {
      userId: prior.userId,
      username: prior.username,
      name: prior.name,
    };
    useSession.setState({
      chat: [],
      table: null,
      private: null,
      lastError: null,
      lastErrorCode: null,
      actionBurst: null,
      userId: HUMAN_ID,
      name: playerName,
    });
    let s = createEmptyTable(config);
    const seated = sitDown(s, 0, HUMAN_ID, playerName, config.buyIn);
    if (!seated.ok) return;
    s = seated.state;
    const taken = new Set([playerName]);
    const namePool = botNames && botNames.length > 0 ? botNames : undefined;
    const bots = Math.max(1, config.maxSeats - 1);
    for (let i = 0; i < bots; i++) {
      const empty = s.players.find((p) => p.status === 'empty');
      if (!empty) break;
      const botName = pickBotName(taken, namePool);
      taken.add(botName);
      const bareId = `off-${i}`;
      const personality = resolveBotPersonalityId(botName, bareId, botStyles);
      const r = sitDown(s, empty.seat, makeBotUserId(bareId, personality), botName, config.buyIn);
      if (r.ok) s = r.state;
    }
    setState(s);
    pushChat({
      userId: 'system',
      name: 'Dealer',
      text: `Offline table ready — you vs ${bots} bot${bots === 1 ? '' : 's'}`,
      at: Date.now(),
    });
    setBootstrapped(true);
    return () => {
      clearBotReadyTimers();
      botReadyIdsRef.current.clear();
      useSession.setState({
        userId: restore.userId,
        username: restore.username,
        name: restore.name,
        table: null,
        private: null,
        chat: [],
        actionBurst: null,
        lastError: null,
        lastErrorCode: null,
      });
    };
  }, [config, playerName, botNames, pushChat, clearBotReadyTimers]);

  useEffect(() => {
    void flushOfflineHandQueue();
  }, []);


  const betweenHands = state.street === 'waiting' || state.street === 'payout';

  useEffect(() => {
    if (!bootstrapped) return;
    if (!betweenHands) {
      resetBotReady();
      return;
    }
    scheduleBotAutoReady(state);
  }, [bootstrapped, betweenHands, state.version, state.street, scheduleBotAutoReady, resetBotReady, state]);

  const publicTable: PublicTable | null = useMemo(() => {
    if (!bootstrapped) return null;
    const view = toPublicView('offline', state, config);
    const humanAvatar = loadSavedAvatarId();
    const between = state.street === 'waiting' || state.street === 'payout';
    return {
      ...view,
      turnEndsAt,
      players: view.players.map((p) => {
        const eligible = between && eligibleForNextHand(p);
        const ready =
          eligible &&
          !!p.userId &&
          isBotUserId(p.userId) &&
          botReadyIdsRef.current.has(p.userId);
        return {
          ...p,
          avatarId:
            p.userId === HUMAN_ID
              ? humanAvatar
              : p.userId
                ? avatarIdFromUserId(p.userId)
                : null,
          ready: Boolean(ready),
        };
      }),
    };
  }, [bootstrapped, state, config, turnEndsAt, botReadyVersion]);

  const priv: PrivateView | null = useMemo(() => {
    if (!bootstrapped) return null;
    const seat = state.players.find((p) => p.userId === HUMAN_ID)?.seat;
    if (seat === undefined) return null;
    return toPrivateView(state, seat, config);
  }, [bootstrapped, state, config]);

  const mySeat = state.players.find((p) => p.userId === HUMAN_ID)?.seat;
  const myPlayer = mySeat !== undefined ? state.players[mySeat] : undefined;
  const canTopUp =
    mySeat !== undefined && !!myPlayer && myPlayer.stack === 0 && betweenHands;
  const canSitOut =
    mySeat !== undefined &&
    betweenHands &&
    !!myPlayer &&
    myPlayer.status !== 'empty' &&
    myPlayer.status !== 'sittingOut';
  const canSitIn =
    mySeat !== undefined && myPlayer?.status === 'sittingOut' && betweenHands;

  const runBotOrTimeout = useCallback(
    (s: HandState) => {
      clearTimer();
      if (s.toAct === null) return;
      if (s.street === 'waiting' || s.street === 'payout' || s.street === 'showdown') return;

      const actor = s.players[s.toAct];
      if (!actor) return;

      if (isBotUserId(actor.userId)) {
        const delay = 650 + Math.floor(Math.random() * 1100);
        setTurnEndsAt(Date.now() + delay);
        timerRef.current = setTimeout(() => {
          setState((curr) => {
            if (curr.toAct === null || curr.toAct !== s.toAct) return curr;
            const intent = chooseBotAction(curr, curr.toAct, config);
            const result = intent
              ? applyAction(curr, curr.toAct, intent, config)
              : applyTimeout(curr, config);
            if (!result.ok) return curr;
            syncChat(result.state, result.events);
            return result.state;
          });
        }, delay);
        return;
      }

      // Human turn — timeout: check if free, else fold
      setTurnEndsAt(Date.now() + config.turnTimeMs);
      timerRef.current = setTimeout(() => {
        setState((curr) => {
          if (curr.toAct === null || !curr.players[curr.toAct] || isBotUserId(curr.players[curr.toAct]!.userId)) {
            return curr;
          }
          const result = applyTimeout(curr, config);
          if (!result.ok) return curr;
          syncChat(result.state, result.events);
          recordChat({
            userId: 'system',
            name: 'Dealer',
            text: 'Time — folded',
            at: Date.now(),
          });
          return result.state;
        });
      }, config.turnTimeMs);
    },
    [config, recordChat, syncChat],
  );

  useEffect(() => {
    if (!bootstrapped) return;
    runBotOrTimeout(state);
    return clearTimer;
    // Intentionally keyed on version/toAct/street so bots advance after each action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, state.version, state.toAct, state.street, runBotOrTimeout]);

  useTableSounds(publicTable);

  const onAction = (action: string, amount?: number) => {
    if (mySeat === undefined || state.toAct !== mySeat) return;
    const type = action as ActionType;
    const result = applyAction(
      state,
      mySeat,
      {
        type,
        amount,
        seq: state.actionSeq,
      },
      config,
    );
    if (!result.ok) return;
    syncChat(result.state, result.events);
    setState(result.state);
  };

  const start = () => {
    if (state.street !== 'waiting' && state.street !== 'payout') return;
    resetBotReady();
    let s = state.street === 'payout' ? returnToWaiting(state) : state;
    handActionsRef.current = [];
    handChatRef.current = [];
    handStartedAtRef.current = Date.now();
    const result = startHand(s, config, `off-${Date.now()}`, randomBytes);
    if (!result.ok) return;
    syncChat(result.state, result.events);
    setState(result.state);
  };

  const doSitOut = () => {
    if (mySeat === undefined) return;
    const result = sitOut(state, mySeat);
    if (!result.ok) return;
    setState(result.state);
  };

  const doSitIn = () => {
    if (mySeat === undefined) return;
    const result = sitIn(state, mySeat);
    if (!result.ok) return;
    setState(result.state);
  };

  const doTopUp = () => {
    if (mySeat === undefined || !canTopUp) return;
    const result = topUp(state, mySeat, config.buyIn, config.buyIn);
    if (!result.ok) return;
    setState(result.state);
  };

  const angles = useMemo(
    () => seatAnglesForHero(config.maxSeats, mySeat),
    [config.maxSeats, mySeat],
  );
  const {
    winBySeat,
    handNameBySeat,
    winningCards,
    highlightMode,
    showWinModal,
    youWon,
  } = useHandPresentation(publicTable, HUMAN_ID, dismissedWinHandId);

  if (!publicTable || !bootstrapped) {
    return <p className="text-ink-strong-muted">Dealing offline table…</p>;
  }

  const isMyTurn = publicTable.toAct === mySeat && !!(priv?.legal?.types.length);
  const potTotal =
    (publicTable.pot || 0) ||
    (publicTable.sidePots?.reduce((s, p) => s + p.amount, 0) ?? 0);
  const dealerPlayer = publicTable.players[publicTable.dealerButton];
  const showDealerZone = publicTable.street !== 'waiting';
  const canStartHand =
    betweenHands &&
    myPlayer?.status !== 'sittingOut' &&
    myPlayer?.status !== 'empty' &&
    coerceMoney(myPlayer?.stack) > 0;
  const eligiblePlayers = publicTable.players.filter((p) => eligibleForNextHand(p));
  const readyCount = eligiblePlayers.filter((p) => p.ready).length;
  const readyRosterPlayers = eligiblePlayers.map((p) => ({
    seat: p.seat,
    name: p.name ?? `Seat ${p.seat}`,
    userId: p.userId,
    avatarId: p.avatarId,
    ready: !!p.ready,
    isSelf: p.userId === HUMAN_ID,
    sittingOut: p.status === 'sittingOut',
  }));
  const showDockReadyRoster = betweenHands && readyRosterPlayers.length > 0;
  const dockReadyHeading =
    publicTable.street === 'waiting' && readyCount === 0
      ? 'Players'
      : publicTable.street === 'waiting'
        ? 'Ready to start'
        : 'Ready for next hand';

  const offlineOverflow: OverflowItem[] = [];
  if (narrow) {
    offlineOverflow.push({
      id: 'chat',
      label: 'Chat',
      onClick: () => setChatOpen(true),
      tone: 'accent',
    });
    if (canSitOut) {
      offlineOverflow.push({
        id: 'sit-out',
        label: 'Sit out',
        onClick: doSitOut,
      });
    }
    if (canSitIn) {
      offlineOverflow.push({
        id: 'sit-in',
        label: 'Sit in',
        onClick: doSitIn,
        tone: 'accent',
      });
    }
    if (canTopUp) {
      offlineOverflow.push({
        id: 'top-up',
        label: 'Top up',
        onClick: doTopUp,
        tone: 'gold',
      });
    }
    offlineOverflow.push({
      id: 'lobby',
      label: 'Back to lobby',
      onClick: () => {
        window.location.href = '/';
      },
      tone: 'danger',
    });
  }

  return (
    <TableShell
      tableColorId={tableColorId}
      onSend={(text) =>
        recordChat({ userId: HUMAN_ID, name: playerName, text, at: Date.now() })
      }
      onEmoji={(emoji) => {
        const at = Date.now();
        setEmoji({ emoji, name: playerName, at });
        recordChat({ userId: HUMAN_ID, name: playerName, text: emoji, at });
        window.setTimeout(() => setEmoji(null), 1800);
      }}
      chatOpen={chatOpen}
      onChatOpenChange={setChatOpen}
      actionsExpanded={!!isMyTurn || canStartHand || canSitIn}
      actions={
        <ActionControls
          onAction={onAction}
          bare
          table={publicTable}
          private={priv}
          userId={HUMAN_ID}
          connection="open"
          tableTools={{
            onStart: canStartHand ? start : undefined,
            startLabel: publicTable.street === 'waiting' ? 'Start hand' : 'Next hand',
            readyCount,
            readyTotal: eligiblePlayers.length,
            readyPlayers: showDockReadyRoster ? readyRosterPlayers : undefined,
            readyHeading: dockReadyHeading,
            canSitOut,
            sitOutLabel: 'Sit out',
            onSitOut: doSitOut,
            canSitIn,
            sitInLabel: 'Sit in',
            onSitIn: doSitIn,
            canTopUp,
            topUpLabel: 'Top up',
            onTopUp: doTopUp,
          }}
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
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
            <span className={buttonClass('chrome', 'md', 'cursor-default text-[10px] uppercase tracking-wider text-sidebar/70 hover:border-sidebar/15 hover:bg-white')}>
              Offline
            </span>
          </div>
          {narrow ? (
            <div className="play-chrome-rail">
              <HowToPlayHelp />
              <TableOverflowMenu items={offlineOverflow} />
            </div>
          ) : (
            <div className="play-chrome-rail">
              <HowToPlayHelp />
              <Button href="/" variant="chrome" className="no-underline">
                Lobby
              </Button>
            </div>
          )}
        </header>

        <div className="play-table-stage">
          <div className="relative min-h-0 flex-1">
          <div
            className={
              narrow
                ? 'absolute inset-0 overflow-hidden felt-surface'
                : 'absolute inset-0 overflow-hidden felt-surface table-rim shadow-felt rounded-[42%] border-[12px]'
            }
          >
          {!narrow ? (
            <div className="play-table-oval-ring" />
          ) : null}

          <div
            className={`absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 ${
              landscape ? 'top-[14%]' : narrow ? 'top-[7%] scale-90' : 'top-[10%]'
            }`}
          >
            <DealerPotZone
              amount={Math.max(potTotal, publicTable.pot)}
              sidePotCount={publicTable.sidePots?.length ?? 0}
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
              cards={publicTable.community}
              handId={publicTable.handId}
              cardSize={narrow ? 'sm' : 'md'}
              compact={narrow}
              landscape={landscape}
              highlightMode={highlightMode}
              winningCards={winningCards}
              street={publicTable.street}
            />
          </div>

          {publicTable.players.map((p) => {
            const win = winBySeat.get(p.seat);
            return (
              <SeatView
                key={p.seat}
                player={p}
                angle={angles[p.seat] ?? 90}
                isToAct={publicTable.toAct === p.seat}
                isSelf={p.userId === HUMAN_ID}
                isWinner={publicTable.street === 'payout' && !!win}
                winAmount={win?.amount}
                handName={
                  publicTable.street === 'payout' || publicTable.street === 'showdown'
                    ? handNameBySeat.get(p.seat) ?? null
                    : null
                }
                handId={publicTable.handId}
                myCards={p.seat === mySeat ? priv?.holeCards ?? null : null}
                winningCards={highlightMode ? winningCards : null}
                turnEndsAt={publicTable.toAct === p.seat ? turnEndsAt : null}
                turnTotalMs={config.turnTimeMs}
                canManageBots={false}
                compact={narrow}
                landscape={landscape}
                isDealer={publicTable.dealerButton === p.seat}
                showReady={betweenHands && !!p.ready}
              />
            );
          })}
          </div>
          </div>
        </div>

      </div>

      {showWinModal && publicTable && (
        <WinHandModal
          youWon={youWon}
          canStartNext={
            myPlayer?.status !== 'sittingOut' &&
            myPlayer?.status !== 'empty' &&
            coerceMoney(myPlayer?.stack) > 0
          }
          canTopUp={canTopUp}
          canSitOut={canSitOut}
          canSitIn={canSitIn}
          readyCount={readyCount}
          readyTotal={eligiblePlayers.length}
          readyPlayers={readyRosterPlayers}
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
            for (const w of publicTable.winners) {
              const prev = bySeat.get(w.seat);
              const cards =
                publicTable.showdownHands?.find((h) => h.seat === w.seat)?.cards ??
                prev?.cards;
              bySeat.set(w.seat, {
                seat: w.seat,
                name: publicTable.players[w.seat]?.name ?? `Seat ${w.seat}`,
                amount: (prev?.amount ?? 0) + w.amount,
                handName: w.handName ?? prev?.handName,
                cards,
                isSelf: publicTable.players[w.seat]?.userId === HUMAN_ID,
              });
            }
            return [...bySeat.values()];
          })()}
          onNextHand={() => {
            setDismissedWinHandId(publicTable.handId);
            start();
          }}
          onTopUp={doTopUp}
          onSitOut={doSitOut}
          onSitIn={doSitIn}
          onDismiss={() => setDismissedWinHandId(publicTable.handId)}
        />
      )}
    </TableShell>
  );
}
