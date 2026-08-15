'use client';

import { useMemo } from 'react';
import { computeHeroHudOdds, type HeroHudOdds } from '@/lib/heroHudOdds';

/** Made-hand name, win equity, and outs-based improvement % for the stacked HUD. */
export function useHeroHudOdds(
  holeCards: [string, string] | null | undefined,
  board: string[] | undefined,
  opponents: number,
  active: boolean,
): HeroHudOdds | null {
  return useMemo(() => {
    if (!active || !holeCards || holeCards.length !== 2) return null;
    return computeHeroHudOdds(holeCards, board ?? [], opponents);
  }, [active, holeCards, board, opponents]);
}
