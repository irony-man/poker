import { SUITS, type Card, type Suit } from './cards.js';
import { legalCards, partnerOf, teamOf, trickWinner } from './rules.js';
import type { CourtpieceState, TrickPlay } from './types.js';

export type BotAction =
  | { type: 'set_trump'; suit: Suit }
  | { type: 'play'; card: Card }
  | { type: 'none' };

function suitStrength(hand: Card[], suit: Suit): number {
  const ofSuit = hand.filter((c) => c.suit === suit);
  if (ofSuit.length === 0) return -1;
  return ofSuit.length * 20 + ofSuit.reduce((n, c) => n + c.rank, 0);
}

function lowestCard(cards: Card[]): Card {
  return [...cards].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit))[0]!;
}

function highestCard(cards: Card[]): Card {
  return [...cards].sort((a, b) => b.rank - a.rank || a.suit.localeCompare(b.suit))[0]!;
}

/** Prefer dumping non-trump, then lowest rank. */
function dumpCard(cards: Card[], trump: Suit): Card {
  const nonTrump = cards.filter((c) => c.suit !== trump);
  return lowestCard(nonTrump.length > 0 ? nonTrump : cards);
}

function chooseLead(hand: Card[], trump: Suit): Card {
  const nonTrumpSuits = SUITS.filter((s) => s !== trump);
  let bestSuit: Suit | null = null;
  let bestScore = -1;
  for (const suit of nonTrumpSuits) {
    const score = suitStrength(hand, suit);
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }
  // Lead trump only when it is clearly the strongest holding (or only suit left).
  const trumpScore = suitStrength(hand, trump);
  if (bestSuit == null || trumpScore > bestScore + 40) {
    const trumpCards = hand.filter((c) => c.suit === trump);
    if (trumpCards.length > 0) return highestCard(trumpCards);
  }
  const leadSuit = bestSuit ?? trump;
  const ofSuit = hand.filter((c) => c.suit === leadSuit);
  return highestCard(ofSuit.length > 0 ? ofSuit : hand);
}

/**
 * Prefer longest/strongest suit for trump.
 * Play: win cheapest if possible; duck under partner; otherwise dump low.
 */
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
  const trump = state.trump!;

  if (state.currentTrick.length === 0) {
    return { type: 'play', card: chooseLead(legal, trump) };
  }

  const partner = partnerOf(seat);
  const partnerWinning =
    state.currentTrick.length > 0 &&
    trickWinner(state.currentTrick, trump) === partner &&
    teamOf(partner) === teamOf(seat);

  const winningPlays: Card[] = [];
  for (const card of legal) {
    const trial: TrickPlay[] = [...state.currentTrick, { seat, card }];
    if (trickWinner(trial, trump) === seat) winningPlays.push(card);
  }

  if (winningPlays.length > 0 && !partnerWinning) {
    // Cheapest card that still takes the trick
    return { type: 'play', card: lowestCard(winningPlays) };
  }

  if (partnerWinning) {
    return { type: 'play', card: dumpCard(legal, trump) };
  }

  // Cannot win (or would rather not) — dump lowest, prefer non-trump
  return { type: 'play', card: dumpCard(legal, trump) };
}
