import { cardToString, type Card, type Suit } from './cards.js';
import { legalCards, partnerOf, teamOf } from './rules.js';
import type { CourtpieceState, MatchPhase, RulesVariant, TeamId } from './types.js';

export interface PublicSeatView {
  seat: number;
  userId: string | null;
  name: string | null;
  isBot: boolean;
  ready: boolean;
  status: CourtpieceState['seats'][number]['status'];
  cardCount: number;
  tricksThisHand: number;
  team: TeamId;
}

export interface PublicTrickPlayView {
  seat: number;
  card: string;
}

export interface PublicCourtpieceView {
  matchId: string;
  phase: MatchPhase;
  rulesVariant: RulesVariant;
  seats: PublicSeatView[];
  dealer: number;
  hakem: number | null;
  trumpSetter: number | null;
  trump: Suit | null;
  currentTrick: PublicTrickPlayView[];
  trickLeader: number | null;
  toAct: number | null;
  teamHands: [number, number];
  handsToWin: number;
  handNumber: number;
  winnerTeam: TeamId | null;
  lastHand: {
    winningTeam: TeamId;
    handsAwarded: number;
    tricks: [number, number];
  } | null;
  actionSeq: number;
  version: number;
  turnTimeMs: number;
}

export interface PrivateCourtpieceView {
  seat: number;
  hand: string[];
  legal: string[];
  partnerSeat: number;
  team: TeamId;
}

export function toPublicView(state: CourtpieceState): PublicCourtpieceView {
  return {
    matchId: state.matchId,
    phase: state.phase,
    rulesVariant: state.config.rulesVariant,
    seats: state.seats.map((s) => ({
      seat: s.seat,
      userId: s.userId,
      name: s.name,
      isBot: s.isBot,
      ready: s.ready,
      status: s.status,
      cardCount: s.hand.length,
      tricksThisHand: s.tricksThisHand,
      team: teamOf(s.seat),
    })),
    dealer: state.dealer,
    hakem: state.hakem,
    trumpSetter: state.trumpSetter,
    trump: state.trump,
    currentTrick: state.currentTrick.map((p) => ({
      seat: p.seat,
      card: cardToString(p.card),
    })),
    trickLeader: state.trickLeader,
    toAct: state.toAct,
    teamHands: [state.teamHands[0], state.teamHands[1]],
    handsToWin: state.config.handsToWin,
    handNumber: state.handNumber,
    winnerTeam: state.winnerTeam,
    lastHand: state.lastHand
      ? {
          winningTeam: state.lastHand.winningTeam,
          handsAwarded: state.lastHand.handsAwarded,
          tricks: [state.lastHand.tricks[0], state.lastHand.tricks[1]],
        }
      : null,
    actionSeq: state.actionSeq,
    version: state.version,
    turnTimeMs: state.config.turnTimeMs,
  };
}

export function toPrivateView(state: CourtpieceState, seat: number): PrivateCourtpieceView | null {
  const p = state.seats[seat];
  if (!p || p.status !== 'seated') return null;
  const sorted = sortHand(p.hand);
  const hand = sorted.map(cardToString);
  let legal: string[] = [];
  if (state.phase === 'playing' && state.toAct === seat) {
    const legalSet = new Set(legalCards(state, seat).map(cardToString));
    legal = hand.filter((c) => legalSet.has(c));
  } else if (state.phase === 'choosing_trump' && state.toAct === seat) {
    legal = [];
  }
  return {
    seat,
    hand,
    legal,
    partnerSeat: partnerOf(seat),
    team: teamOf(seat),
  };
}

export function sortHand(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { s: 0, h: 1, d: 2, c: 3 };
  return [...cards].sort((a, b) => {
    const sd = suitOrder[a.suit] - suitOrder[b.suit];
    if (sd !== 0) return sd;
    return b.rank - a.rank;
  });
}
