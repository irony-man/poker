import type { MemoryState } from './types.js';

export type BotAction =
  | { type: 'flip'; index: number }
  | { type: 'none' };

/**
 * Remember face-up history from unmatched peeks via pairId when visible in state.
 * Simple: prefer completing a known pair from faceUp length 1, else flip unmatched unknown.
 */
export function chooseBotAction(state: MemoryState): BotAction {
  if (state.phase !== 'playing' || state.toAct == null) return { type: 'none' };
  if (state.faceUp.length >= 2) return { type: 'none' };

  const open = state.cards
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => !c.matched && !state.faceUp.includes(i));

  if (state.faceUp.length === 1) {
    const first = state.faceUp[0]!;
    const need = state.cards[first]!.pairId;
    const match = open.find(({ c }) => c.pairId === need);
    if (match) return { type: 'flip', index: match.i };
  }

  if (open.length === 0) return { type: 'none' };
  return { type: 'flip', index: open[0]!.i };
}
