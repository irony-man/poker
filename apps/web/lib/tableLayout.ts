'use client';

import { useEffect, useState } from 'react';

/** Remaining ms until `endsAt` (epoch). Updates ~10×/sec. */
export function useTurnRemainingMs(endsAt: number | null | undefined): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }
    const tick = () => setRemaining(Math.max(0, endsAt - Date.now()));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return remaining;
}

export function formatTurnSeconds(ms: number): string {
  return (Math.ceil(ms / 1000)).toString();
}

/**
 * Seat angles with `heroSeat` fixed at the bottom (90°).
 * Spectators (no hero) keep seat 0 at the bottom.
 */
export function seatAnglesForHero(maxSeats: number, heroSeat: number | undefined): number[] {
  const step = 360 / maxSeats;
  const hero = heroSeat ?? 0;
  return Array.from({ length: maxSeats }, (_, seat) => {
    const offset = (seat - hero + maxSeats) % maxSeats;
    return 90 + offset * step;
  });
}
