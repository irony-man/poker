'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyAction,
  applyTimeout,
  cardToString,
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
  type EngineEvent,
  type HandState,
  type TableConfig,
} from '@poker/engine';
import { ActionControls } from './ActionControls';
import { FloatingActionDock } from './FloatingActionDock';
import { PlayingCard } from './PlayingCard';
import { PotBanner } from './PotBanner';
import { SeatView } from './SeatView';
import { TableShell } from './TableShell';
import { TurnTimerBar } from './TurnTimer';
import { WinHandModal } from './WinHandModal';
import { playTick } from '@/lib/audio';
import { avatarIdFromUserId, loadSavedAvatarId } from '@/lib/avatars';
import { useSession, type ChatMessage, type PrivateView, type PublicTable } from '@/lib/store';
import { seatAnglesForHero } from '@/lib/tableLayout';

const HUMAN_ID = 'offline-human';

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

function formatAction(
  action: string,
  amount: number,
): string {
  switch (action) {
    case 'fold':
      return 'folds';
    case 'check':
      return 'checks';
    case 'call':
      return `calls ${amount}`;
    case 'bet':
      return `bets ${amount}`;
    case 'raise':
      return `raises to ${amount}`;
    case 'allin':
      return amount > 0 ? `goes all-in (${amount})` : 'goes all-in';
    default:
      return action;
  }
}

function announceEvents(
  state: HandState,
  events: EngineEvent[],
  push: (m: ChatMessage) => void,
) {
  for (const e of events) {
    if (e.type === 'action') {
      const name = state.players[e.seat]?.name ?? `Seat ${e.seat}`;
      push({ userId: 'system', name, text: formatAction(e.action, e.amount), at: Date.now() });
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
          text: `${name} wins ${w.amount}${hand}`,
          at: Date.now(),
        });
      } else if (e.winners.length > 1) {
        const parts = e.winners.map((w) => {
          const name = state.players[w.seat]?.name ?? `Seat ${w.seat}`;
          const hand =
            w.handName && w.handName !== 'Uncontested' ? ` (${w.handName})` : '';
          return `${name} ${w.amount}${hand}`;
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
        text: `Blinds — ${sb} posts ${e.sb}, ${bb} posts ${e.bb}`,
        at: Date.now(),
      });
    }
  }
}

export function OfflineTableView({
  config,
  botCount,
  playerName,
}: {
  config: TableConfig;
  botCount: number;
  playerName: string;
}) {
  const pushChat = useSession((s) => s.pushChat);
  const setSession = useSession((s) => s.setSession);
  const setEmoji = useSession((s) => s.setEmoji);

  const [state, setState] = useState<HandState>(() => createEmptyTable(config));
  const [bootstrapped, setBootstrapped] = useState(false);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [dismissedWinHandId, setDismissedWinHandId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVersion = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTurnEndsAt(null);
  };

  const syncChat = useCallback(
    (next: HandState, events: EngineEvent[]) => {
      announceEvents(next, events, pushChat);
    },
    [pushChat],
  );

  // Seed human + bots once
  useEffect(() => {
    useSession.setState({ chat: [], table: null, private: null, lastError: null });
    setSession({ userId: HUMAN_ID, name: playerName, ticket: 'offline' });
    let s = createEmptyTable(config);
    const seated = sitDown(s, 0, HUMAN_ID, playerName, config.minBuyIn);
    if (!seated.ok) return;
    s = seated.state;
    const taken = new Set([playerName]);
    const bots = Math.min(botCount, config.maxSeats - 1);
    for (let i = 0; i < bots; i++) {
      const empty = s.players.find((p) => p.status === 'empty');
      if (!empty) break;
      const botName = pickBotName(taken);
      taken.add(botName);
      const r = sitDown(s, empty.seat, makeBotUserId(`off-${i}`), botName, config.minBuyIn);
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
  }, [botCount, config, playerName, pushChat, setSession]);

  const publicTable: PublicTable | null = useMemo(() => {
    if (!bootstrapped) return null;
    const view = toPublicView('offline', state, config) as unknown as PublicTable;
    const humanAvatar = loadSavedAvatarId();
    return {
      ...view,
      turnEndsAt,
      players: view.players.map((p) => ({
        ...p,
        avatarId:
          p.userId === HUMAN_ID
            ? humanAvatar
            : p.userId
              ? avatarIdFromUserId(p.userId)
              : null,
      })),
    };
  }, [bootstrapped, state, config, turnEndsAt]);

  const priv: PrivateView | null = useMemo(() => {
    if (!bootstrapped) return null;
    const seat = state.players.find((p) => p.userId === HUMAN_ID)?.seat;
    if (seat === undefined) return null;
    return toPrivateView(state, seat, config) as unknown as PrivateView;
  }, [bootstrapped, state, config]);

  const mySeat = state.players.find((p) => p.userId === HUMAN_ID)?.seat;

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
          pushChat({
            userId: 'system',
            name: 'Dealer',
            text: 'Time — folded',
            at: Date.now(),
          });
          return result.state;
        });
      }, config.turnTimeMs);
    },
    [config, pushChat, syncChat],
  );

  useEffect(() => {
    if (!bootstrapped) return;
    runBotOrTimeout(state);
    return clearTimer;
    // Intentionally keyed on version/toAct/street so bots advance after each action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, state.version, state.toAct, state.street, runBotOrTimeout]);

  useEffect(() => {
    if (!publicTable) return;
    if (prevVersion.current !== null && publicTable.version !== prevVersion.current) {
      if (publicTable.street === 'payout') playTick('win');
      else if (publicTable.community.length > 0) playTick('deal');
      else playTick('action');
    }
    prevVersion.current = publicTable.version;
  }, [publicTable]);

  const onAction = (action: string, amount?: number) => {
    if (mySeat === undefined || state.toAct !== mySeat) return;
    const result = applyAction(
      state,
      mySeat,
      {
        type: action as 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin',
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
    let s = state.street === 'payout' ? returnToWaiting(state) : state;
    const result = startHand(s, config, `off-${Date.now()}`, randomBytes);
    if (!result.ok) return;
    syncChat(result.state, result.events);
    setState(result.state);
  };

  const angles = useMemo(
    () => seatAnglesForHero(config.maxSeats, mySeat),
    [config.maxSeats, mySeat],
  );
  const winBySeat = useMemo(() => {
    const map = new Map<number, { amount: number; handName?: string }>();
    for (const w of publicTable?.winners ?? []) {
      const prev = map.get(w.seat);
      const handName =
        w.handName && w.handName !== 'Uncontested' ? w.handName : prev?.handName;
      map.set(w.seat, {
        amount: (prev?.amount ?? 0) + w.amount,
        handName,
      });
    }
    return map;
  }, [publicTable?.winners]);

  const handNameBySeat = useMemo(() => {
    const map = new Map<number, string>();
    for (const h of publicTable?.showdownHands ?? []) map.set(h.seat, h.handName);
    for (const [seat, w] of winBySeat) {
      if (w.handName && !map.has(seat)) map.set(seat, w.handName);
    }
    return map;
  }, [publicTable?.showdownHands, winBySeat]);

  const winningCards = useMemo(() => {
    const codes = new Set<string>();
    if (!publicTable || (publicTable.street !== 'payout' && publicTable.street !== 'showdown')) {
      return codes;
    }
    const winnerSeats = new Set(publicTable.winners.map((w) => w.seat));
    for (const h of publicTable.showdownHands ?? []) {
      if (!winnerSeats.has(h.seat)) continue;
      for (const c of h.cards ?? []) codes.add(c);
    }
    return codes;
  }, [publicTable]);
  const highlightMode = winningCards.size > 0;
  const showWinModal =
    publicTable?.street === 'payout' &&
    publicTable.winners.length > 0 &&
    publicTable.handId !== dismissedWinHandId;
  const youWon = !!publicTable?.winners.some(
    (w) => publicTable.players[w.seat]?.userId === HUMAN_ID,
  );

  // Patch session private/table for ActionControls which reads zustand
  useEffect(() => {
    if (!publicTable) return;
    useSession.setState({ table: publicTable, private: priv });
  }, [publicTable, priv]);

  if (!publicTable || !bootstrapped) {
    return <p className="text-cream/60">Dealing offline table…</p>;
  }

  const isMyTurn = publicTable.toAct === mySeat && !!(priv?.legal?.types.length);
  const potTotal =
    (publicTable.pot || 0) ||
    (publicTable.sidePots?.reduce((s, p) => s + p.amount, 0) ?? 0);

  return (
    <TableShell
      onSend={(text) =>
        pushChat({ userId: HUMAN_ID, name: playerName, text, at: Date.now() })
      }
      onEmoji={(emoji) => {
        const at = Date.now();
        setEmoji({ emoji, name: playerName, at });
        pushChat({ userId: HUMAN_ID, name: playerName, text: emoji, at });
        window.setTimeout(() => setEmoji(null), 1800);
      }}
    >
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 text-sm text-cream/60">
          <div className="flex items-center gap-2">
            <span className="status-chip border-felt-neon/30 bg-felt-neon/10 text-felt-neon">
              Offline
            </span>
            <span className="status-chip border-cyan/25 bg-cyan/10 text-cyan capitalize">
              {publicTable.street}
            </span>
            <span className="text-xs text-cream/40">
              blinds {config.smallBlind}/{config.bigBlind}
            </span>
          </div>
          <a href="/" className="text-xs text-gold/80 hover:text-gold">
            ← Lobby
          </a>
        </div>

        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 felt-surface rounded-[36%] border-[10px] table-rim shadow-felt overflow-hidden sm:rounded-[42%] sm:border-[12px]">
          <div className="pointer-events-none absolute inset-6 rounded-[40%] border border-felt-neon/10 z-[1]" />

          <div className="absolute left-1/2 top-[22%] z-20 -translate-x-1/2 -translate-y-1/2">
            <PotBanner amount={Math.max(potTotal, publicTable.pot)} />
          </div>

          <div className="absolute left-1/2 top-[48%] z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
            <div className="flex min-h-[5.25rem] items-center gap-1.5">
              {publicTable.community.map((c, i) => (
                <PlayingCard
                  key={`${publicTable.handId}-${c}`}
                  code={c}
                  dealDelay={i * 0.07}
                  highlight={highlightMode && winningCards.has(c)}
                  dimmed={highlightMode && !winningCards.has(c)}
                />
              ))}
              {publicTable.community.length === 0 && publicTable.street !== 'waiting' && (
                <span className="text-cream/40 text-xs font-display uppercase tracking-wider">Dealing…</span>
              )}
            </div>
          </div>

          {publicTable.players.map((p) => {
            const win = winBySeat.get(p.seat);
            return (
              <SeatView
                key={p.seat}
                player={p}
                angle={angles[p.seat] ?? 90}
                isDealer={publicTable.dealerButton === p.seat && publicTable.street !== 'waiting'}
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
              />
            );
          })}
          </div>

          {turnEndsAt && publicTable.toAct !== null && publicTable.toAct !== mySeat && (
            <div className="absolute inset-x-0 top-2 z-30 flex justify-center px-3">
              <div className="w-full max-w-sm">
                <TurnTimerBar endsAt={turnEndsAt} totalMs={config.turnTimeMs} />
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border border-cream/15 bg-ink/85 px-2 py-1.5 backdrop-blur-md">
              {(publicTable.street === 'waiting' || publicTable.street === 'payout') && (
                <button type="button" onClick={start} className="btn-ghost text-xs py-1.5">
                  {publicTable.street === 'waiting' ? 'Start hand' : 'Next hand'}
                </button>
              )}
            </div>
          </div>
        </div>

        <FloatingActionDock expanded={!!isMyTurn} label="Actions">
          <ActionControls onAction={onAction} bare />
        </FloatingActionDock>
      </div>

      {showWinModal && publicTable && (
        <WinHandModal
          youWon={youWon}
          canStartNext
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
          onDismiss={() => setDismissedWinHandId(publicTable.handId)}
        />
      )}
    </TableShell>
  );
}
