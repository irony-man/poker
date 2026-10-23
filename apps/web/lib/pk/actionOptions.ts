/**
 * Raise bounds and action labels. The snap, clamp, and preset math matches
 * ActionControls (betAmount snap to the big blind, half-pot and pot presets).
 */

export type LegalActionSet = {
  types: readonly string[];
  callAmount: number;
  minRaiseTo: number;
  maxRaiseTo: number;
};

export function snapToBlind(value: number, bigBlind: number): number {
  if (bigBlind <= 0) return Math.round(value);
  return Math.round(value / bigBlind) * bigBlind;
}

export function clampRaise(raw: number, min: number, max: number, bigBlind: number): number {
  if (max <= min) return min;
  return snapToBlind(Math.min(max, Math.max(min, raw)), bigBlind);
}

export function raisePresets(
  pot: number,
  currentBet: number,
  min: number,
  max: number,
  bigBlind: number,
): { halfPot: number; pot: number } {
  const halfPot = snapToBlind(Math.min(max, Math.max(min, Math.floor(pot / 2) + currentBet)), bigBlind);
  const potBet = snapToBlind(Math.min(max, Math.max(min, pot + currentBet)), bigBlind);
  return { halfPot, pot: potBet };
}

export type ActionBarModel = {
  types: string[];
  callAmount: number;
  min: number;
  max: number;
  canBet: boolean;
  betLabel: 'Bet' | 'Raise';
  betAction: 'bet' | 'raise';
  halfPot: number;
  potBet: number;
};

export function actionBarModel(
  legal: LegalActionSet | null | undefined,
  pot: number,
  currentBet: number,
  bigBlind: number,
): ActionBarModel {
  const types = [...(legal?.types ?? [])];
  const min = legal?.minRaiseTo ?? 0;
  const max = legal?.maxRaiseTo ?? 0;
  const canBet = types.includes('bet') || types.includes('raise');
  const betLabel = types.includes('bet') ? 'Bet' : 'Raise';
  const betAction = types.includes('bet') ? 'bet' : 'raise';
  const presets = raisePresets(pot, currentBet, min, max, bigBlind);
  return {
    types,
    callAmount: legal?.callAmount ?? 0,
    min,
    max,
    canBet,
    betLabel,
    betAction,
    halfPot: presets.halfPot,
    potBet: presets.pot,
  };
}

/** Same confirm rules as ActionControls.needsConfirm. */
export function actionNeedsConfirm(
  action: string,
  amount: number | undefined,
  callAmount: number,
  stack: number,
): boolean {
  if (action === 'allin') return true;
  if (action === 'fold' && callAmount > 0 && callAmount >= stack * 0.4) return true;
  if ((action === 'bet' || action === 'raise') && amount != null && stack > 0 && amount >= stack * 0.5) {
    return true;
  }
  return false;
}

export function timerRing(now: number, endsAt: number | null | undefined, totalMs: number): {
  remainingMs: number;
  fraction: number;
  warning: boolean;
} {
  if (!endsAt || totalMs <= 0) return { remainingMs: 0, fraction: 0, warning: false };
  const remainingMs = Math.max(0, endsAt - now);
  const fraction = Math.min(1, remainingMs / totalMs);
  return { remainingMs, fraction, warning: remainingMs > 0 && remainingMs <= 5000 };
}
