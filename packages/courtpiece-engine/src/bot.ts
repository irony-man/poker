import { SUITS, type Card, type Suit } from './cards.js';
import { legalCards } from './rules.js';
import type { CourtpieceState } from './types.js';

export type BotAction =
  | { type: 'set_trump'; suit: Suit }
  | { type: 'play'; card: Card }
  | { type: 'none' };

function suitStrength(hand: Card[], suit: Suit): number {
  return hand.filter((c) => c.suit === suit).reduce((n, c) => n + c.rank, 0);
}

/** Prefer longest/strongest suit for trump; play lowest legal otherwise. */
export function chooseBotAction(state: CourtpieceState): BotAction {
  if (state.toAct == null) return { type: 'none' };
  const seat = state.toAct;
  const hand = state.seats[seat]?.hand ?? [];

  if (state.phase === 'choosing_trump') {
    let best: Suit = 's';
    let bestScore = -1;
    for (const suit of SUITS) {
      const score = suitStrength(hand, suit);
      if (score > bestScore) {
        bestScore = score;
        best = suit;
      }
    }
    return { type: 'set_trump', suit: best };
  }

  if (state.phase !== 'playing') return { type: 'none' };
  const legal = legalCards(state, seat);
  if (legal.length === 0) return { type: 'none' };

  // Prefer follow-suit already encoded in legal; play lowest rank
  const sorted = [...legal].sort((a, b) => a.rank - b.rank);
  return { type: 'play', card: sorted[0]! };
}
