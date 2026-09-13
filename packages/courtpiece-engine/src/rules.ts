import {
  cardEquals,
  createDeck,
  defaultShuffle,
  type Card,
  type Suit,
} from './cards.js';
import {
  CARDS_PER_HAND,
  HOKM_PREVIEW,
  SEAT_COUNT,
  type CourtpieceState,
  type SeatState,
  type TeamId,
  type TrickPlay,
} from './types.js';

export function emptySeat(seat: number): SeatState {
  return {
    seat,
    userId: null,
    name: null,
    isBot: false,
    ready: false,
    status: 'empty',
    hand: [],
    tricksThisHand: 0,
  };
}

export function cloneState(state: CourtpieceState): CourtpieceState {
  return {
    ...state,
    config: { ...state.config },
    seats: state.seats.map((s) => ({
      ...s,
      hand: s.hand.map((c) => ({ ...c })),
    })),
    currentTrick: state.currentTrick.map((p) => ({
      seat: p.seat,
      card: { ...p.card },
    })),
    teamHands: [state.teamHands[0], state.teamHands[1]],
    lastHand: state.lastHand
      ? {
          winningTeam: state.lastHand.winningTeam,
          handsAwarded: state.lastHand.handsAwarded,
          tricks: [state.lastHand.tricks[0], state.lastHand.tricks[1]],
        }
      : null,
    undealt: state.undealt.map((c) => ({ ...c })),
  };
}

export function seatedSeats(state: CourtpieceState): SeatState[] {
  return state.seats.filter((s) => s.status === 'seated');
}

export function teamOf(seat: number): TeamId {
  return (seat % 2) as TeamId;
}

export function partnerOf(seat: number): number {
  return (seat + 2) % SEAT_COUNT;
}

export function nextSeat(fromSeat: number): number {
  return (fromSeat + 1) % SEAT_COUNT;
}

export function clearHands(state: CourtpieceState): void {
  for (const seat of state.seats) {
    seat.hand = [];
    seat.tricksThisHand = 0;
  }
  state.currentTrick = [];
  state.trickLeader = null;
  state.trump = null;
  state.undealt = [];
}

/** Deal full 13 cards to each of 4 seats from a shuffled deck. */
export function dealFull(
  state: CourtpieceState,
  shuffle: <T>(arr: T[]) => T[] = defaultShuffle,
): void {
  const deck = shuffle(createDeck());
  clearHands(state);
  for (let i = 0; i < CARDS_PER_HAND; i++) {
    for (let seat = 0; seat < SEAT_COUNT; seat++) {
      state.seats[seat]!.hand.push(deck[i * SEAT_COUNT + seat]!);
    }
  }
}

/**
 * Hokm preview: give hakem 5 cards; hold the rest until trump is set.
 * Other seats get empty hands until completeDealAfterTrump.
 */
export function dealHokmPreview(
  state: CourtpieceState,
  hakem: number,
  shuffle: <T>(arr: T[]) => T[] = defaultShuffle,
): void {
  const deck = shuffle(createDeck());
  clearHands(state);
  state.seats[hakem]!.hand = deck.slice(0, HOKM_PREVIEW);
  state.undealt = deck.slice(HOKM_PREVIEW);
}

/** After trump in Hokm: finish dealing so everyone has 13. */
export function completeDealAfterTrump(state: CourtpieceState): void {
  const hakem = state.hakem!;
  const needHakem = CARDS_PER_HAND - state.seats[hakem]!.hand.length;
  let i = 0;
  for (let n = 0; n < needHakem; n++) {
    state.seats[hakem]!.hand.push(state.undealt[i++]!);
  }
  for (let seat = 0; seat < SEAT_COUNT; seat++) {
    if (seat === hakem) continue;
    for (let n = 0; n < CARDS_PER_HAND; n++) {
      state.seats[seat]!.hand.push(state.undealt[i++]!);
    }
  }
  state.undealt = [];
}

export function legalCards(state: CourtpieceState, seat: number): Card[] {
  const hand = state.seats[seat]?.hand ?? [];
  if (hand.length === 0) return [];
  if (state.currentTrick.length === 0) return [...hand];
  const led = state.currentTrick[0]!.card.suit;
  const follow = hand.filter((c) => c.suit === led);
  return follow.length > 0 ? follow : [...hand];
}

export function isLegalPlay(state: CourtpieceState, seat: number, card: Card): boolean {
  const hand = state.seats[seat]?.hand ?? [];
  if (!hand.some((c) => cardEquals(c, card))) return false;
  return legalCards(state, seat).some((c) => cardEquals(c, card));
}

export function trickWinner(plays: TrickPlay[], trump: Suit): number {
  const led = plays[0]!.card.suit;
  let best = plays[0]!;
  for (let i = 1; i < plays.length; i++) {
    const p = plays[i]!;
    const bc = best.card;
    const pc = p.card;
    const bestTrump = bc.suit === trump;
    const playTrump = pc.suit === trump;
    if (playTrump && !bestTrump) {
      best = p;
      continue;
    }
    if (!playTrump && bestTrump) continue;
    if (playTrump && bestTrump) {
      if (pc.rank > bc.rank) best = p;
      continue;
    }
    // Neither trump: only same as led can win
    if (pc.suit === led && (bc.suit !== led || pc.rank > bc.rank)) {
      best = p;
    }
  }
  return best.seat;
}

export function teamTrickCounts(state: CourtpieceState): [number, number] {
  const t: [number, number] = [0, 0];
  for (const seat of state.seats) {
    t[teamOf(seat.seat)] += seat.tricksThisHand;
  }
  return t;
}

/**
 * Score a completed hand.
 * Returns winning team and hands awarded.
 */
export function scoreHand(state: CourtpieceState): {
  winningTeam: TeamId;
  handsAwarded: number;
  tricks: [number, number];
} {
  const tricks = teamTrickCounts(state);
  const winningTeam: TeamId = tricks[0] >= tricks[1] ? 0 : 1;
  const winTricks = tricks[winningTeam];
  const loseTricks = tricks[(1 - winningTeam) as TeamId];

  let handsAwarded = 1;
  if (state.config.rulesVariant === 'classic_full') {
    if (winTricks === 13) handsAwarded = 2; // court
    else if (loseTricks < 4) handsAwarded = 2; // baazi
  }

  return { winningTeam, handsAwarded, tricks };
}

export { defaultShuffle, createDeck };
