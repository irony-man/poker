/** Placeholder motion until the designer signs off. Reduced motion is handled in poker-v2.css. */

export const pkMotion = {
  dealMs: 180,
  chipsToPotMs: 240,
  potToWinnerMs: 400,
  cardFlipMs: 200,
  winHighlightMs: 1200,
  timerWarningMs: 5000,
  sheet: { type: 'spring' as const, stiffness: 380, damping: 34 },
};

export function dealDelay(index: number): number {
  return index * pkMotion.dealMs;
}
