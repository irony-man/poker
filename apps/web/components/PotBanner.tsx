'use client';

import { ChipDisc, formatChips } from './ChipStack';

/** Large center pot like classic mobile freepoker tables. */
export function PotBanner({
  amount,
  sidePotCount = 0,
}: {
  amount: number;
  sidePotCount?: number;
}) {
  const value = Math.max(0, amount);
  return (
    <div className="pointer-events-none flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]">
        <ChipDisc amount={Math.max(value, 1)} size={28} />
        <span className="font-display text-3xl font-extrabold tabular-nums tracking-tight text-white sm:text-4xl">
          ${formatChips(value)}
        </span>
      </div>
      {sidePotCount > 1 && (
        <span className="rounded bg-black/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/70">
          {sidePotCount} pots
        </span>
      )}
    </div>
  );
}
