import { legalActions } from './hand.js';
import type { ActionIntent, ActionType, HandState, TableConfig } from './hand.js';

const BOT_PREFIX = 'bot:';

export function isBotUserId(userId: string | null | undefined): boolean {
  return !!userId && userId.startsWith(BOT_PREFIX);
}

export function makeBotUserId(id: string): string {
  return `${BOT_PREFIX}${id}`;
}

const BOT_NAMES = [
  'AceBot',
  'RiverRat',
  'BluffByte',
  'PotOdds',
  'ChipShark',
  'FoldBot',
  'AllInAnnie',
  'NutsNova',
  'CallCart',
  'RaiseRex',
];

export function pickBotName(taken: Set<string>): string {
  for (const n of BOT_NAMES) {
    if (!taken.has(n)) return n;
  }
  return `Bot${Math.floor(Math.random() * 900) + 100}`;
}

function snapToBb(amount: number, bb: number, min: number, max: number): number {
  const snapped = Math.round(amount / bb) * bb;
  return Math.max(min, Math.min(max, snapped));
}

/** Lightweight heuristic bot — check/call-heavy with occasional aggression. */
export function chooseBotAction(
  state: HandState,
  seat: number,
  config: TableConfig,
): ActionIntent | null {
  const legal = legalActions(state, seat, config);
  if (legal.types.length === 0) return null;

  const types = new Set(legal.types);
  const seq = state.actionSeq;
  const player = state.players[seat]!;
  const r = Math.random();
  const bb = config.bigBlind;

  const tryRaiseOrBet = (prefer: 'bet' | 'raise'): ActionIntent | null => {
    if (!types.has(prefer) && !types.has('allin')) return null;
    const min = legal.minRaiseTo;
    const max = legal.maxRaiseTo;
    if (max < min) {
      return types.has('allin') ? { type: 'allin', seq } : null;
    }
    const stack = player.stack;
    if (stack <= bb * 8 && types.has('allin') && r < 0.45) {
      return { type: 'allin', seq };
    }
    const span = max - min;
    const target = snapToBb(min + span * (0.2 + r * 0.35), bb, min, max);
    return { type: prefer, amount: target, seq };
  };

  if (types.has('check')) {
    if (r < 0.28) {
      const bet = tryRaiseOrBet('bet');
      if (bet) return bet;
    }
    return { type: 'check', seq };
  }

  const callAmt = legal.callAmount;
  const pot = Math.max(1, state.pot);
  const commitFrac = callAmt / Math.max(1, player.stack);
  const potOdds = callAmt / (pot + callAmt);

  if (types.has('fold') && commitFrac > 0.35 && r < 0.55 + potOdds * 0.2) {
    return { type: 'fold', seq };
  }

  if (r < 0.18) {
    const raise = tryRaiseOrBet('raise');
    if (raise) return raise;
  }

  if (types.has('call')) {
    if (commitFrac < 0.2 || r < 0.65) return { type: 'call', seq };
  }

  if (types.has('allin') && (player.stack <= bb * 6 || r < 0.08)) {
    return { type: 'allin', seq };
  }

  if (types.has('call')) return { type: 'call', seq };
  if (types.has('fold')) return { type: 'fold', seq };

  const fallback = (legal.types.find((t) => t !== 'fold') ?? legal.types[0]) as ActionType;
  return {
    type: fallback,
    amount: fallback === 'bet' || fallback === 'raise' ? legal.minRaiseTo : undefined,
    seq,
  };
}
