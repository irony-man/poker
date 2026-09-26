import type { HandState } from '@poker/engine';
import { isBotUserId } from '@poker/engine';
import { coerceMoney } from './currency';

/** Human eliminated all bots (session won); stacks checked between hands. */
export function isOfflineGameComplete(state: HandState, humanUserId: string): boolean {
  if (state.street !== 'payout' && state.street !== 'waiting') return false;
  const human = state.players.find((p) => p.userId === humanUserId);
  if (!human || coerceMoney(human.stack) <= 0) return false;
  let bots = 0;
  for (const p of state.players) {
    if (!p.userId || !isBotUserId(p.userId)) continue;
    bots++;
    if (coerceMoney(p.stack) > 0) return false;
  }
  return bots > 0;
}
