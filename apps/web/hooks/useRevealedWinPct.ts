'use client';

import { useMemo } from 'react';
import {
  computeRevealedWinPct,
  revealedHolesFromPlayers,
  type SeatWinPct,
} from '@/lib/showdownEquity';

/** Win% among publicly revealed hole cards (spectators + showdown UI). */
export function useRevealedWinPct(
  players:
    | { seat: number; holeCards: [string, string] | null; status: string }[]
    | undefined,
  community: string[] | undefined,
  active: boolean,
): SeatWinPct {
  return useMemo(() => {
    if (!active || !players) return new Map();
    const hands = revealedHolesFromPlayers(players);
    if (hands.length === 0) return new Map();
    return computeRevealedWinPct(hands, community ?? []);
  }, [active, players, community]);
}
