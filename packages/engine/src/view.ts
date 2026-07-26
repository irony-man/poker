import { cardToString, type Card } from './cards.js';
import type { HandState, PlayerState, Street, TableConfig } from './hand.js';
import { legalActions } from './hand.js';
import type { PotLayer } from './pots.js';

export interface PublicPlayerView {
  seat: number;
  userId: string | null;
  name: string | null;
  stack: number;
  bet: number;
  status: PlayerState['status'];
  hasCards: boolean;
  /** Only present when revealed at showdown. */
  holeCards: [string, string] | null;
}

export interface PublicTableView {
  tableId: string;
  handId: string;
  street: Street;
  community: string[];
  players: PublicPlayerView[];
  dealerButton: number;
  sbSeat: number;
  bbSeat: number;
  toAct: number | null;
  currentBet: number;
  pot: number;
  sidePots: PotLayer[];
  actionSeq: number;
  version: number;
  winners: { seat: number; amount: number; handName?: string }[];
  /** Revealed showdown hands (category + best five cards) for UI. */
  showdownHands: { seat: number; handName: string; cards: string[] }[];
  config: TableConfig;
}

export interface PrivateView {
  seat: number;
  holeCards: [string, string] | null;
  legal: ReturnType<typeof legalActions>;
}

function cardStr(c: Card): string {
  return cardToString(c);
}

export function toPublicView(tableId: string, state: HandState, config: TableConfig): PublicTableView {
  return {
    tableId,
    handId: state.handId,
    street: state.street,
    community: state.community.map(cardStr),
    players: state.players.map((p) => ({
      seat: p.seat,
      userId: p.userId,
      name: p.name,
      stack: p.stack,
      bet: p.bet,
      status: p.status,
      hasCards: p.holeCards !== null && p.status !== 'folded' && p.status !== 'empty',
      holeCards:
        p.revealed && p.holeCards
          ? [cardStr(p.holeCards[0]), cardStr(p.holeCards[1])]
          : null,
    })),
    dealerButton: state.dealerButton,
    sbSeat: state.sbSeat,
    bbSeat: state.bbSeat,
    toAct: state.toAct,
    currentBet: state.currentBet,
    pot: state.pot,
    sidePots: state.sidePots,
    actionSeq: state.actionSeq,
    version: state.version,
    winners: state.winners,
    showdownHands: state.showdownHands,
    config,
  };
}

export function toPrivateView(state: HandState, seat: number, config: TableConfig): PrivateView {
  const p = state.players[seat];
  return {
    seat,
    holeCards: p?.holeCards ? [cardStr(p.holeCards[0]), cardStr(p.holeCards[1])] : null,
    legal: legalActions(state, seat, config),
  };
}
