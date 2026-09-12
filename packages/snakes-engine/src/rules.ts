import { SEAT_COUNT, TELEPORTS, type SeatState, type SnakesState } from './types.js';

export function emptySeat(seat: number): SeatState {
  return {
    seat,
    userId: null,
    name: null,
    isBot: false,
    ready: false,
    status: 'empty',
    position: 0,
  };
}

export function cloneState(state: SnakesState): SnakesState {
  return {
    ...state,
    config: { ...state.config },
    seats: state.seats.map((s) => ({ ...s })),
  };
}

export function seatedSeats(state: SnakesState): SeatState[] {
  return state.seats.filter((s) => s.status === 'seated');
}

export function firstSeatedSeat(state: SnakesState): number | null {
  const s = seatedSeats(state);
  return s[0]?.seat ?? null;
}

export function nextSeatedSeat(state: SnakesState, fromSeat: number): number {
  for (let i = 1; i <= SEAT_COUNT; i++) {
    const seat = (fromSeat + i) % SEAT_COUNT;
    if (state.seats[seat]?.status === 'seated') return seat;
  }
  return fromSeat;
}

/** Apply die from `from` with bounce-at-end and optional teleport. */
export function resolveMove(from: number, die: number): { to: number; teleport: number | null } {
  let landed = from + die;
  if (landed > 100) {
    landed = 100 - (landed - 100);
  }
  const teleport = TELEPORTS[landed] ?? null;
  return { to: teleport ?? landed, teleport };
}
