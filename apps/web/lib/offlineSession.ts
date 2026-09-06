import type { Card, HandState, PlayerState, Street, TableConfig } from '@poker/engine';

export const OFFLINE_SESSION_KEY = 'felt-offline-session';
export const OFFLINE_SESSION_VERSION = 1;
const HUMAN_ID = 'offline-human';

const STREETS = new Set<Street>([
  'waiting',
  'preflop',
  'flop',
  'turn',
  'river',
  'showdown',
  'payout',
]);

const STATUSES = new Set([
  'empty',
  'seated',
  'active',
  'folded',
  'allin',
  'sittingOut',
]);

export type OfflineSessionSnapshot = {
  version: typeof OFFLINE_SESSION_VERSION;
  savedAt: number;
  playerName: string;
  seats: number;
  botGroupId: string | null;
  config: TableConfig;
  tableId: string;
  state: HandState;
};

type SerializedHandState = Omit<HandState, 'actedSinceAggression'> & {
  actedSinceAggression: number[];
};

type SerializedSnapshot = Omit<OfflineSessionSnapshot, 'state'> & {
  state: SerializedHandState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCard(value: unknown): value is Card {
  if (!isRecord(value)) return false;
  const rank = value.rank;
  const suit = value.suit;
  return (
    typeof rank === 'number' &&
    rank >= 2 &&
    rank <= 14 &&
    (suit === 'c' || suit === 'd' || suit === 'h' || suit === 's')
  );
}

function parseCards(value: unknown): Card[] | null {
  if (!Array.isArray(value)) return null;
  const cards: Card[] = [];
  for (const item of value) {
    if (!isCard(item)) return null;
    cards.push({ rank: item.rank, suit: item.suit });
  }
  return cards;
}

function parseHole(value: unknown): [Card, Card] | null | undefined {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  if (!isCard(value[0]) || !isCard(value[1])) return undefined;
  return [
    { rank: value[0].rank, suit: value[0].suit },
    { rank: value[1].rank, suit: value[1].suit },
  ];
}

function parsePlayer(value: unknown, seat: number): PlayerState | null {
  if (!isRecord(value)) return null;
  if (value.seat !== seat) return null;
  const status = value.status;
  if (typeof status !== 'string' || !STATUSES.has(status)) return null;
  const hole = parseHole(value.holeCards);
  if (hole === undefined) return null;
  if (!isFiniteInt(value.stack) || !isFiniteInt(value.bet) || !isFiniteInt(value.committed)) {
    return null;
  }
  const userId = value.userId;
  const name = value.name;
  if (userId !== null && typeof userId !== 'string') return null;
  if (name !== null && typeof name !== 'string') return null;
  return {
    seat,
    userId,
    name,
    stack: value.stack,
    bet: value.bet,
    committed: value.committed,
    status: status as PlayerState['status'],
    holeCards: hole,
    revealed: value.revealed === true,
  };
}

function parseConfig(value: unknown, seats: number): TableConfig | null {
  if (!isRecord(value)) return null;
  if (value.maxSeats !== seats) return null;
  if (
    !isFiniteInt(value.smallBlind) ||
    !isFiniteInt(value.bigBlind) ||
    !isFiniteInt(value.buyIn) ||
    !isFiniteInt(value.turnTimeMs)
  ) {
    return null;
  }
  return {
    maxSeats: seats,
    smallBlind: value.smallBlind,
    bigBlind: value.bigBlind,
    buyIn: value.buyIn,
    turnTimeMs: value.turnTimeMs,
  };
}

function parseHandState(value: unknown, seats: number): HandState | null {
  if (!isRecord(value)) return null;
  if (typeof value.street !== 'string' || !STREETS.has(value.street as Street)) return null;
  if (typeof value.handId !== 'string') return null;
  const deck = parseCards(value.deck);
  const community = parseCards(value.community);
  if (!deck || !community) return null;
  if (!Array.isArray(value.players) || value.players.length !== seats) return null;
  const players: PlayerState[] = [];
  for (let i = 0; i < seats; i++) {
    const p = parsePlayer(value.players[i], i);
    if (!p) return null;
    players.push(p);
  }
  if (!players.some((p) => p.userId === HUMAN_ID)) return null;

  const actedRaw = value.actedSinceAggression;
  if (!Array.isArray(actedRaw) || !actedRaw.every((n) => isFiniteInt(n))) return null;

  if (
    !isFiniteInt(value.dealerButton) ||
    !isFiniteInt(value.sbSeat) ||
    !isFiniteInt(value.bbSeat) ||
    !isFiniteInt(value.currentBet) ||
    !isFiniteInt(value.minRaiseTo) ||
    !isFiniteInt(value.lastRaiseSize) ||
    !isFiniteInt(value.pot) ||
    !isFiniteInt(value.actionSeq) ||
    !isFiniteInt(value.version)
  ) {
    return null;
  }
  if (value.toAct !== null && !isFiniteInt(value.toAct)) return null;
  if (!Array.isArray(value.sidePots) || !Array.isArray(value.winners) || !Array.isArray(value.showdownHands)) {
    return null;
  }

  return {
    handId: value.handId,
    street: value.street as Street,
    deck,
    community,
    players,
    dealerButton: value.dealerButton,
    sbSeat: value.sbSeat,
    bbSeat: value.bbSeat,
    toAct: value.toAct,
    currentBet: value.currentBet,
    minRaiseTo: value.minRaiseTo,
    lastRaiseSize: value.lastRaiseSize,
    pot: value.pot,
    sidePots: value.sidePots as HandState['sidePots'],
    winners: value.winners as HandState['winners'],
    showdownHands: value.showdownHands as HandState['showdownHands'],
    actedSinceAggression: new Set(actedRaw),
    actionSeq: value.actionSeq,
    version: value.version,
  };
}

/** Convert engine state to a JSON-safe snapshot (Set → array). */
export function serializeHandState(state: HandState): SerializedHandState {
  return {
    ...state,
    actedSinceAggression: [...state.actedSinceAggression],
  };
}

export function parseOfflineSession(raw: unknown): OfflineSessionSnapshot | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== OFFLINE_SESSION_VERSION) return null;
  if (!isFiniteInt(raw.savedAt) || typeof raw.playerName !== 'string' || typeof raw.tableId !== 'string') {
    return null;
  }
  if (!isFiniteInt(raw.seats) || raw.seats < 2 || raw.seats > 9) return null;
  const botGroupId = raw.botGroupId;
  if (botGroupId !== null && typeof botGroupId !== 'string') return null;
  const config = parseConfig(raw.config, raw.seats);
  if (!config) return null;
  const state = parseHandState(raw.state, raw.seats);
  if (!state) return null;
  return {
    version: OFFLINE_SESSION_VERSION,
    savedAt: raw.savedAt,
    playerName: raw.playerName,
    seats: raw.seats,
    botGroupId,
    config,
    tableId: raw.tableId,
    state,
  };
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function clearOfflineSession(): void {
  storage()?.removeItem(OFFLINE_SESSION_KEY);
}

export function saveOfflineSession(
  snapshot: Omit<OfflineSessionSnapshot, 'version' | 'savedAt'> & { savedAt?: number },
): void {
  const store = storage();
  if (!store) return;
  const payload: SerializedSnapshot = {
    version: OFFLINE_SESSION_VERSION,
    savedAt: snapshot.savedAt ?? Date.now(),
    playerName: snapshot.playerName,
    seats: snapshot.seats,
    botGroupId: snapshot.botGroupId,
    config: snapshot.config,
    tableId: snapshot.tableId,
    state: serializeHandState(snapshot.state),
  };
  try {
    store.setItem(OFFLINE_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function loadOfflineSession(): OfflineSessionSnapshot | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    const parsed = parseOfflineSession(JSON.parse(raw) as unknown);
    if (!parsed) {
      store.removeItem(OFFLINE_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    store.removeItem(OFFLINE_SESSION_KEY);
    return null;
  }
}

export function hasOfflineSession(): boolean {
  return loadOfflineSession() !== null;
}
