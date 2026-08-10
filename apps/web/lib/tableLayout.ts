'use client';

import { useEffect, useState } from 'react';

/**
 * True for phone layouts: portrait (<640px wide) OR short/wide phone/tablet
 * landscape. Tailwind `sm` alone misses rotated phones (e.g. 844×390).
 */
export function useIsNarrow(
  query = '(max-width: 639px), (max-height: 560px) and (max-width: 1100px)',
): boolean {
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

/** Short landscape — single-row action bar instead of stacked dock. */
export function useIsLandscapePhone(
  query = '(orientation: landscape) and (max-height: 500px)',
): boolean {
  const [short, setShort] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setShort(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);

  return short;
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
  return Math.ceil(ms / 1000).toString();
}

const BOTTOM_CENTER = 90;

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Degrees reserved at the top for dealer button + pot (centered at 270°).
 * Shrinks as maxSeats grows so opponents form a fuller circle on mobile.
 */
export function seatTopGapDeg(maxSeats: number): number {
  if (maxSeats <= 2) return 100;
  if (maxSeats <= 4) return 88;
  if (maxSeats <= 6) return 72;
  if (maxSeats <= 7) return 60;
  return 50;
}

/**
 * Seat angles with `heroSeat` fixed at the bottom center (90°) and the top reserved for dealer/pot.
 * Spectators (no hero) keep seat 0 at the bottom.
 */
export function seatAnglesForHero(maxSeats: number, heroSeat: number | undefined): number[] {
  const hero = heroSeat ?? 0;
  const gapHalf = seatTopGapDeg(maxSeats) / 2;
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

export type SeatEllipseRadii = {
  rx: number;
  ry: number;
  betRx: number;
  betRy: number;
};

/** Place seats on the oval; denser tables pull closer to the rim. */
export function seatEllipseRadii(opts: {
  maxSeats: number;
  compact?: boolean;
  landscape?: boolean;
}): SeatEllipseRadii {
  const { maxSeats, compact, landscape } = opts;
  const dense = maxSeats >= 7;

  if (landscape) {
    return {
      rx: dense ? 43 : 41,
      ry: dense ? 36 : 34,
      betRx: dense ? 24 : 22,
      betRy: dense ? 20 : 18,
    };
  }
  if (compact) {
    return {
      rx: dense ? 44 : 42,
      ry: dense ? 42 : 40,
      betRx: dense ? 26 : 24,
      betRy: dense ? 22 : 20,
    };
  }
  return {
    rx: dense ? 43 : 41,
    ry: dense ? 39 : 37,
    betRx: dense ? 25 : 23,
    betRy: dense ? 21 : 19,
  };
}

/** Ring avatar diameter in px — scales down when many seats crowd mobile. */
export function seatSlotAvatarSize(opts: {
  maxSeats: number;
  compact?: boolean;
  isSelf?: boolean;
}): number {
  const dense = opts.maxSeats >= 7;
  if (opts.compact) {
    if (dense) return opts.isSelf ? 32 : 28;
    return opts.isSelf ? 36 : 32;
  }
  if (dense) return opts.isSelf ? 34 : 30;
  return opts.isSelf ? 38 : 34;
}
