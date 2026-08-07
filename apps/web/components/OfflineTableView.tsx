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
  returnToWaiting,
  sitDown,
  sitIn,
  sitOut,
  startHand,
  topUp,
  toPrivateView,
  toPublicView,
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
import {
  LeaderboardToggle,
  TableLeaderboard,
  loadShowLeaderboard,
  saveShowLeaderboard,
} from './TableLeaderboard';
import { TableOverflowMenu, type OverflowItem } from './TableOverflowMenu';
import { TableShell } from './TableShell';
import { WinHandModal } from './WinHandModal';
import { playTick } from '@/lib/audio';
import { avatarIdFromUserId, loadSavedAvatarId } from '@/lib/avatars';
import { useSession, type ChatMessage, type PrivateView, type PublicTable } from '@/lib/store';
import { seatAnglesForHero, useIsLandscapePhone, useIsNarrow } from '@/lib/tableLayout';

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

function formatActionPopup(action: string, amount: number): string {
  switch (action) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return `Call ${amount}`;
    case 'bet':
      return `Bet ${amount}`;
    case 'raise':
      return `Raise ${amount}`;
    case 'allin':
      return amount > 0 ? `All-in ${amount}` : 'All-in';
    default:
      return action;
  }
}

function announceEvents(
  state: HandState,
  events: EngineEvent[],
  push: (m: ChatMessage) => void,
  onSeatAction?: (seat: number, label: string) => void,
) {
  for (const e of events) {
    if (e.type === 'action') {
      const name = state.players[e.seat]?.name ?? `Seat ${e.seat}`;
      push({ userId: 'system', name, text: formatAction(e.action, e.amount), at: Date.now() });
      onSeatAction?.(e.seat, formatActionPopup(e.action, e.amount));
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
  playerName,
}: {
  config: TableConfig;
  playerName: string;
}) {
  const pushChat = useSession((s) => s.pushChat);
  const setSession = useSession((s) => s.setSession);
  const setEmoji = useSession((s) => s.setEmoji);
  const setActionBurst = useSession((s) => s.setActionBurst);
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();

  const [state, setState] = useState<HandState>(() => createEmptyTable(config));
  const [bootstrapped, setBootstrapped] = useState(false);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [dismissedWinHandId, setDismissedWinHandId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVersion = useRef<number | null>(null);

  useEffect(() => {
    setShowLeaderboard(loadShowLeaderboard());
  }, []);

  const toggleLeaderboard = () => {
    setShowLeaderboard((prev) => {
      const next = !prev;
      saveShowLeaderboard(next);
      return next;
    });
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTurnEndsAt(null);
  };

  const syncChat = useCallback(
    (next: HandState, events: EngineEvent[]) => {
      announceEvents(next, events, pushChat, (seat, label) => {
        if (!isSeatActionLabel(label)) return;
        setActionBurst({ seat, label, at: Date.now() });
      });
    },
    [pushChat, setActionBurst],
  );

  // Seed human + bots once
  useEffect(() => {
    useSession.setState({
      chat: [],
      table: null,
      private: null,
      lastError: null,
      lastErrorCode: null,
      actionBurst: null,
    });
    setSession({ userId: HUMAN_ID, name: playerName, ticket: 'offline' });
    let s = createEmptyTable(config);
    const seated = sitDown(s, 0, HUMAN_ID, playerName, config.buyIn);
    if (!seated.ok) return;
    s = seated.state;
    const taken = new Set([playerName]);
    const bots = Math.max(1, config.maxSeats - 1);
    for (let i = 0; i < bots; i++) {
      const empty = s.players.find((p) => p.status === 'empty');
      if (!empty) break;
      const botName = pickBotName(taken);
      taken.add(botName);
      const r = sitDown(s, empty.seat, makeBotUserId(`off-${i}`), botName, config.buyIn);
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
  }, [config, playerName, pushChat, setSession]);

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
  const myPlayer = mySeat !== undefined ? state.players[mySeat] : undefined;
  const betweenHands = state.street === 'waiting' || state.street === 'payout';
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
    return <p className="text-ink-strong-muted">Dealing offline table…</p>;
  }

  const isMyTurn = publicTable.toAct === mySeat && !!(priv?.legal?.types.length);
  const potTotal =
    (publicTable.pot || 0) ||
    (publicTable.sidePots?.reduce((s, p) => s + p.amount, 0) ?? 0);
  const dealerPlayer = publicTable.players[publicTable.dealerButton];
  const showDealerZone = publicTable.street !== 'waiting';
  const showMobileStartCta = narrow && betweenHands;
  const showDesktopTools = !narrow;

  const offlineOverflow: OverflowItem[] = [];
  if (narrow) {
    offlineOverflow.push({
      id: 'chat',
      label: 'Chat',
      onClick: () => setChatOpen(true),
      tone: 'accent',
    });
    offlineOverflow.push({
      id: 'leaderboard',
      label: showLeaderboard ? 'Hide leaderboard' : 'Show leaderboard',
      onClick: toggleLeaderboard,
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
      onSend={(text) =>
        pushChat({ userId: HUMAN_ID, name: playerName, text, at: Date.now() })
      }
      onEmoji={(emoji) => {
        const at = Date.now();
        setEmoji({ emoji, name: playerName, at });
        pushChat({ userId: HUMAN_ID, name: playerName, text: emoji, at });
        window.setTimeout(() => setEmoji(null), 1800);
      }}
      chatOpen={chatOpen}
      onChatOpenChange={setChatOpen}
      actionsExpanded={!!isMyTurn}
      actions={<ActionControls onAction={onAction} bare />}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex shrink-0 items-center justify-between gap-2 px-1.5 text-sm text-ink-strong-muted sm:mb-2 sm:px-0">
          <div className="flex min-w-0 items-center gap-2">
            <Image
              src="/purple-logo.png"
              alt="POKR"
              width={140}
              height={40}
              className="h-7 w-auto object-contain object-left sm:h-8"
              priority
            />
          </div>
          {narrow ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <HowToPlayHelp />
              <TableOverflowMenu items={offlineOverflow} />
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <LeaderboardToggle open={showLeaderboard} onToggle={toggleLeaderboard} />
              <HowToPlayHelp />
              <a href="/" className="text-[10px] text-sidebar/80 hover:text-sidebar sm:text-xs">
                ← Lobby
              </a>
            </div>
          )}
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
          <div
            className={
              narrow
                ? 'absolute inset-0 overflow-hidden felt-surface'
                : 'absolute inset-0 overflow-hidden felt-surface table-rim shadow-felt rounded-[42%] border-[12px]'
            }
          >
          {!narrow ? (
            <div className="pointer-events-none absolute inset-6 z-[1] rounded-[40%] border border-white/10" />
          ) : null}

          <TableLeaderboard
            players={publicTable.players}
            userId={HUMAN_ID}
            open={showLeaderboard}
            onClose={() => {
              setShowLeaderboard(false);
              saveShowLeaderboard(false);
            }}
            compact={narrow}
          />

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
              dealing={publicTable.street !== 'waiting'}
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
              />
            );
          })}
          </div>
          </div>

          {showMobileStartCta && (
            <div className="relative z-30 flex shrink-0 justify-center px-1 pb-0.5 pt-1">
              <button
                type="button"
                onClick={start}
                className="btn-primary min-h-10 px-5 text-[11px] font-display font-bold uppercase tracking-wide"
              >
                {publicTable.street === 'waiting' ? 'Start hand' : 'Next hand'}
              </button>
            </div>
          )}

          {showDesktopTools && (
          <div className="relative z-30 flex shrink-0 justify-center px-2 pb-1 pt-2">
            <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border border-sidebar/15 bg-white/80 px-2 py-1.5 backdrop-blur-md shadow-[0_8px_24px_rgb(29_4_50/0.1)]">
              {betweenHands && (
                <button type="button" onClick={start} className="btn-ghost text-xs py-1.5">
                  {publicTable.street === 'waiting' ? 'Start hand' : 'Next hand'}
                </button>
              )}
              {canSitOut && (
                <button
                  type="button"
                  onClick={doSitOut}
                  className="rounded-full border border-amber-600/30 px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-500/10"
                >
                  Sit out
                </button>
              )}
              {canSitIn && (
                <button
                  type="button"
                  onClick={doSitIn}
                  className="rounded-full border border-sidebar/30 bg-sidebar/8 px-3 py-1.5 text-xs text-sidebar hover:bg-sidebar/12"
                >
                  Sit in
                </button>
              )}
              {canTopUp && (
                <button
                  type="button"
                  onClick={doTopUp}
                  className="rounded-full border border-sidebar/25 bg-sidebar/8 px-3 py-1.5 text-xs text-sidebar hover:bg-sidebar/12"
                >
                  Top up
                </button>
              )}
            </div>
          </div>
          )}
        </div>

      </div>

      {showWinModal && publicTable && (
        <WinHandModal
          youWon={youWon}
          canStartNext={myPlayer?.status !== 'sittingOut'}
          canTopUp={canTopUp}
          canSitOut={canSitOut}
          canSitIn={canSitIn}
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
