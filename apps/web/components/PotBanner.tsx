'use client';

import { ChipDisc, formatChips } from './ChipStack';

/** Large center pot like classic mobile freepoker tables. */
export function PotBanner({
  amount,
  sidePotCount = 0,
  landscape = false,
}: {
  amount: number;
  sidePotCount?: number;
  /** Phone landscape: multi-chip pile + display pot (reference layout). */
  landscape?: boolean;
}) {
  const value = Math.max(0, amount);
  return (
    <div className="pointer-events-none flex flex-col items-center gap-1">
      <div
        className={`flex items-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)] ${
          landscape ? 'flex-col gap-0.5' : 'gap-2'
        }`}
      >
        {landscape ? (
          <div className="relative mb-0.5 flex h-5 w-12 items-end justify-center">
            <span className="absolute left-1 bottom-0">
              <ChipDisc amount={Math.max(value, 1)} size={18} />
            </span>
            <span className="absolute left-1/2 bottom-0 -translate-x-1/2 z-[1]">
              <ChipDisc amount={Math.max(value, 25)} size={20} />
            </span>
            <span className="absolute right-1 bottom-0">
              <ChipDisc amount={Math.max(value, 100)} size={18} />
            </span>
          </div>
        ) : (
          <ChipDisc amount={Math.max(value, 1)} size={28} />
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
        <span className="rounded bg-black/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/70">
          {sidePotCount} pots
        </span>
      )}
    </div>
  );
}
