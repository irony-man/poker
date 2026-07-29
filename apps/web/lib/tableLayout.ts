'use client';

import { useEffect, useState } from 'react';

/** True below Tailwind `sm` (640px) — portrait phone layout. */
export function useIsNarrow(query = '(max-width: 639px)'): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);

  return narrow;
}

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

const BOTTOM_CENTER = 90;
/** Degrees reserved at the top for dealer button + pot (centered at 270°). */
const TOP_GAP_DEG = 80;

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Seat angles with `heroSeat` fixed at the bottom center (90°) and the top reserved for dealer/pot.
 * Spectators (no hero) keep seat 0 at the bottom.
 */
export function seatAnglesForHero(maxSeats: number, heroSeat: number | undefined): number[] {
  const hero = heroSeat ?? 0;
  const gapHalf = TOP_GAP_DEG / 2;
  const arcStart = 270 + gapHalf;
  const arcEnd = 270 - gapHalf + 360;
  const arcSpan = arcEnd - arcStart;

  const positions = Array.from({ length: maxSeats }, (_, i) => {
    const frac = maxSeats <= 1 ? 0.5 : i / (maxSeats - 1);
    return normalizeAngle(arcStart + frac * arcSpan);
  });

  const bottomIdx = positions.reduce((best, ang, idx) => {
    const dist = Math.abs(normalizeAngle(ang) - BOTTOM_CENTER);
    const bestDist = Math.abs(normalizeAngle(positions[best]!) - BOTTOM_CENTER);
    return dist < bestDist ? idx : best;
  }, 0);

  return Array.from({ length: maxSeats }, (_, seat) => {
    if (seat === hero) return BOTTOM_CENTER;
    const offset = (seat - hero + maxSeats) % maxSeats;
    const posIdx = (bottomIdx + offset) % maxSeats;
    return positions[posIdx]!;
  });
}
