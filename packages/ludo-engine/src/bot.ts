import { previewMove } from './rules.js';
import type { LudoState } from './types.js';

export type BotAction =
  | { type: 'roll' }
  | { type: 'move'; tokenIndex: number }
  | { type: 'none' };

/**
 * Greedy, deterministic token pick:
 * capture → enter home → leave yard → advance the token closest to home.
 * Ties break toward the lowest token index.
 */
export function chooseBotToken(state: LudoState): number | null {
  if (state.phase !== 'moving' || state.toAct == null || state.lastDie == null) return null;
  const seat = state.toAct;
  const die = state.lastDie;
  const moves = state.legalMoves.length > 0 ? state.legalMoves : [];
  if (moves.length === 0) return null;

  let best: { tokenIndex: number; rank: number; progress: number } | null = null;
  for (const tokenIndex of moves) {
    const preview = previewMove(state, seat, tokenIndex, die);
    if (!preview) continue;
    const rank =
      preview.captures.length > 0 ? 0 : preview.entersHome ? 1 : preview.leavesYard ? 2 : 3;
    if (
      !best ||
      rank < best.rank ||
      (rank === best.rank && preview.progress > best.progress) ||
      (rank === best.rank && preview.progress === best.progress && tokenIndex < best.tokenIndex)
    ) {
      best = { tokenIndex, rank, progress: preview.progress };
    }
  }
  return best?.tokenIndex ?? null;
}

export function chooseBotAction(state: LudoState): BotAction {
  if (state.phase === 'rolling' && state.toAct != null) return { type: 'roll' };
  if (state.phase === 'moving' && state.toAct != null) {
    const tokenIndex = chooseBotToken(state);
    if (tokenIndex != null) return { type: 'move', tokenIndex };
  }
  return { type: 'none' };
}
