'use client';

import { ChipStack, formatChips } from './ChipStack';

/** Large center pot like classic mobile freepoker tables. */
export function PotBanner({
  amount,
  sidePotCount = 0,
  landscape = false,
}: {
  amount: number;
  sidePotCount?: number;
  /** Phone landscape: stack above the amount (reference layout). */
  landscape?: boolean;
}) {
  const value = Math.max(0, amount);
  return (
    <div className="pointer-events-none flex flex-col items-center gap-1">
      <div
        className={`flex items-end drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)] ${
          landscape ? 'flex-col items-center gap-0.5' : 'gap-2'
        }`}
      >
        {value > 0 ? (
          <ChipStack amount={value} size="md" label={false} />
        ) : (
          <ChipStack amount={1} size="md" label={false} />
        )}
        <span
          className={`tabular-nums tracking-tight text-white ${
            landscape
              ? 'font-display text-2xl font-bold drop-shadow-md'
              : 'font-display text-3xl font-extrabold sm:text-4xl'
          }`}
        >
          {formatChips(value)}
        </span>
      </div>
      {sidePotCount > 1 && (
        <span className="rounded bg-black/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cream/85">
          {sidePotCount} pots
        </span>
      )}
    </div>
  );
}
