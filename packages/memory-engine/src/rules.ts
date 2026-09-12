import { SEAT_COUNT, type CardState, type GridSize, type SeatState, type MemoryState } from './types.js';

export function emptySeat(seat: number): SeatState {
  return {
    seat,
    userId: null,
    name: null,
    isBot: false,
    ready: false,
    status: 'empty',
    pairs: 0,
  };
}

export function cloneState(state: MemoryState): MemoryState {
  return {
    ...state,
    config: { ...state.config },
    seats: state.seats.map((s) => ({ ...s })),
    cards: state.cards.map((c) => ({ ...c })),
    faceUp: [...state.faceUp],
    winnerSeats: [...state.winnerSeats],
  };
}

export function seatedSeats(state: MemoryState): SeatState[] {
  return state.seats.filter((s) => s.status === 'seated');
}

export function firstSeatedSeat(state: MemoryState): number | null {
  return seatedSeats(state)[0]?.seat ?? null;
}

export function nextSeatedSeat(state: MemoryState, fromSeat: number): number {
  for (let i = 1; i <= SEAT_COUNT; i++) {
    const seat = (fromSeat + i) % SEAT_COUNT;
    if (state.seats[seat]?.status === 'seated') return seat;
  }
  return fromSeat;
}

export function defaultShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function buildDeck(gridSize: GridSize, shuffle = defaultShuffle): CardState[] {
  const pairCount = gridSize / 2;
  const ids: number[] = [];
  for (let i = 0; i < pairCount; i++) {
    ids.push(i, i);
  }
  return shuffle(ids).map((pairId) => ({ pairId, matched: false }));
}

export function allMatched(state: MemoryState): boolean {
  return state.cards.every((c) => c.matched);
}

export function winnersByPairs(state: MemoryState): number[] {
  const seated = seatedSeats(state);
  if (seated.length === 0) return [];
  const max = Math.max(...seated.map((s) => s.pairs));
  return seated.filter((s) => s.pairs === max).map((s) => s.seat);
}
