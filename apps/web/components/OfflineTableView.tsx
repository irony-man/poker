'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
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
import { ChatPanel } from './ChatPanel';
import { ChipStack, formatChips } from './ChipStack';
import { PlayingCard } from './PlayingCard';
import { SeatView } from './SeatView';
import { playTick } from '@/lib/audio';
import { useSession, type ChatMessage, type PrivateView, type PublicTable } from '@/lib/store';

const TableAtmosphere = dynamic(
  () => import('./three/TableAtmosphere').then((m) => m.TableAtmosphere),
  { ssr: false },
);

const HUMAN_ID = 'offline-human';

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

function seatAngles(maxSeats: number): number[] {
  const start = 90;
  const step = 360 / maxSeats;
  return Array.from({ length: maxSeats }, (_, i) => start + i * step);
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
        const hand = w.handName ? ` with ${w.handName}` : '';
        push({
          userId: 'system',
          name: 'Dealer',
          text: `${name} wins ${w.amount}${hand}`,
          at: Date.now(),
        });
      } else if (e.winners.length > 1) {
        const parts = e.winners.map((w) => {
          const name = state.players[w.seat]?.name ?? `Seat ${w.seat}`;
          return `${name} ${w.amount}${w.handName ? ` (${w.handName})` : ''}`;
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

  const [state, setState] = useState<HandState>(() => createEmptyTable(config));
  const [bootstrapped, setBootstrapped] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVersion = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
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
    return toPublicView('offline', state, config) as unknown as PublicTable;
  }, [bootstrapped, state, config]);

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
        }, 650 + Math.floor(Math.random() * 1100));
        return;
      }

      // Human turn — soft timeout
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
            text: 'Time — auto action',
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

  // After payout, return to waiting then auto-start next hand
  useEffect(() => {
    if (state.street !== 'payout') return;
    const t = setTimeout(() => {
      setState((curr) => {
        if (curr.street !== 'payout') return curr;
        let next = returnToWaiting(curr);
        const start = startHand(next, config, `off-${Date.now()}`, randomBytes);
        if (start.ok) {
          syncChat(start.state, start.events);
          return start.state;
        }
        return next;
      });
    }, 2800);
    return () => clearTimeout(t);
  }, [state.street, config, syncChat]);

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

  const angles = useMemo(() => seatAngles(config.maxSeats), [config.maxSeats]);
  const winBySeat = useMemo(() => {
    const map = new Map<number, { amount: number; handName?: string }>();
    for (const w of publicTable?.winners ?? []) {
      const prev = map.get(w.seat);
      map.set(w.seat, {
        amount: (prev?.amount ?? 0) + w.amount,
        handName: w.handName ?? prev?.handName,
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

  // Patch session private/table for ActionControls which reads zustand
  useEffect(() => {
    if (!publicTable) return;
    useSession.setState({ table: publicTable, private: priv });
  }, [publicTable, priv]);

  if (!publicTable || !bootstrapped) {
    return <p className="text-cream/60">Dealing offline table…</p>;
  }

  const potTotal =
    (publicTable.pot || 0) ||
    (publicTable.sidePots?.reduce((s, p) => s + p.amount, 0) ?? 0);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100dvh-5rem)]">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2 text-sm text-cream/60">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-900/50 border border-emerald-500/30 px-2.5 py-0.5 text-emerald-300 tracking-wide text-xs">
              Offline
            </span>
            <span className="rounded-full bg-cream/10 px-2.5 py-0.5 text-cream capitalize tracking-wide">
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

        <div className="relative flex-1 felt-surface rounded-[42%] border-[12px] border-[#3a2814] shadow-felt min-h-[340px] overflow-hidden">
          <TableAtmosphere
            celebrate={publicTable.street === 'payout'}
            dealKey={publicTable.community.length}
          />
          <div className="pointer-events-none absolute inset-6 rounded-[40%] border border-white/5 z-[1]" />

          <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-10">
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-ink/35 px-4 py-2 border border-cream/10 backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-[0.2em] text-cream/50">Pot</div>
              <ChipStack amount={Math.max(potTotal, publicTable.pot)} size="lg" />
            </div>
            <div className="flex gap-1.5 min-h-[5.25rem] items-center">
              {publicTable.community.map((c) => (
                <PlayingCard key={c + publicTable.version} code={c} />
              ))}
              {publicTable.community.length === 0 && publicTable.street !== 'waiting' && (
                <span className="text-cream/40 text-xs">Dealing…</span>
              )}
            </div>
          </div>

          {publicTable.street === 'payout' && publicTable.winners.length > 0 && (
            <div className="absolute left-1/2 top-[12%] -translate-x-1/2 z-30 w-[min(92%,22rem)]">
              <div className="rounded-2xl border border-gold/40 bg-ink/90 px-4 py-3 text-center shadow-xl backdrop-blur-md">
                <div className="text-[10px] uppercase tracking-[0.25em] text-gold/80 mb-1">Winner</div>
                {publicTable.winners.map((w, i) => {
                  const name = publicTable.players[w.seat]?.name ?? `Seat ${w.seat}`;
                  return (
                    <div key={`${w.seat}-${i}`} className="py-1">
                      <div className="font-display text-lg text-gold">{name}</div>
                      <div className="text-sm text-cream/80">
                        {w.handName ?? 'Win'} · +{formatChips(w.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {publicTable.players.map((p, i) => {
            const win = winBySeat.get(p.seat);
            return (
              <SeatView
                key={p.seat}
                player={p}
                angle={angles[i] ?? 90}
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
                myCards={p.seat === mySeat ? priv?.holeCards ?? null : null}
                canManageBots={false}
              />
            );
          })}
        </div>

        <div className="mt-4 pb-[env(safe-area-inset-bottom)]">
          <ActionControls onAction={onAction} />
          <div className="mt-2 w-full max-w-xl mx-auto flex flex-wrap gap-2 justify-center">
            {(publicTable.street === 'waiting' || publicTable.street === 'payout') && (
              <button
                type="button"
                onClick={start}
                className="rounded-lg border border-gold/40 px-4 py-2 text-sm text-gold hover:bg-gold/10"
              >
                {publicTable.street === 'waiting' ? 'Start hand' : 'Next hand'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:w-72 shrink-0 relative">
        <ChatPanel
          onSend={(text) =>
            pushChat({ userId: HUMAN_ID, name: playerName, text, at: Date.now() })
          }
          onEmoji={() => undefined}
        />
      </div>
    </div>
  );
}
