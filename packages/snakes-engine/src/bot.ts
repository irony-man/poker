import type { SnakesState } from './types.js';

export type BotAction = { type: 'roll' } | { type: 'none' };

export function chooseBotAction(state: SnakesState): BotAction {
  if (state.phase === 'rolling' && state.toAct != null) return { type: 'roll' };
  return { type: 'none' };
}
