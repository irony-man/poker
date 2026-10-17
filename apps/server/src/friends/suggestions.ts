import { isBotUserId } from '../bot.js';

export type SuggestionReason = 'mutual' | 'played' | 'both';

export interface RankedSuggestion {
  userId: string;
  score: number;
  mutualFriendIds: string[];
  handsTogether: number;
  reason: SuggestionReason;
}

export const DEFAULT_SUGGESTION_LIMIT = 12;
const MUTUAL_WEIGHT = 3;
const HANDS_TOGETHER_CAP = 10;

/** Merge mutual-friend and played-together signals into a ranked list. */
export function rankSuggestions({
  mutual,
  handsTogether,
  exclude,
  limit = DEFAULT_SUGGESTION_LIMIT,
  nameOf,
}: {
  mutual: Map<string, string[]>;
  handsTogether: Map<string, number>;
  exclude: Set<string>;
  limit?: number;
  /** Tie-break by display name when scores match. */
  nameOf?: (userId: string) => string;
}): RankedSuggestion[] {
  const ids = new Set([...mutual.keys(), ...handsTogether.keys()]);
  const out: RankedSuggestion[] = [];
  for (const userId of ids) {
    if (exclude.has(userId) || isBotUserId(userId)) continue;
    const mutualFriendIds = mutual.get(userId) ?? [];
    const hands = handsTogether.get(userId) ?? 0;
    if (mutualFriendIds.length === 0 && hands === 0) continue;
    const reason: SuggestionReason =
      mutualFriendIds.length > 0 && hands > 0
        ? 'both'
        : mutualFriendIds.length > 0
          ? 'mutual'
          : 'played';
    out.push({
      userId,
      score: MUTUAL_WEIGHT * mutualFriendIds.length + Math.min(hands, HANDS_TOGETHER_CAP),
      mutualFriendIds,
      handsTogether: hands,
      reason,
    });
  }
  const label = nameOf ?? ((id: string) => id);
  out.sort((a, b) => b.score - a.score || label(a.userId).localeCompare(label(b.userId)));
  return out.slice(0, Math.max(0, limit));
}
