'use client';

import { formatChips } from './ChipStack';

/** High-contrast pot readout — sits above the board so cards never cover it. */
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
      <div className="flex items-center gap-2.5 rounded-full border border-gold/50 bg-ink/90 px-4 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.55)] backdrop-blur-md ring-1 ring-black/40">
        <span className="text-[10px] font-display font-bold uppercase tracking-[0.28em] text-gold/80">
          Pot
        </span>
        <span className="font-mono text-xl font-bold tabular-nums tracking-tight text-gold-light sm:text-2xl">
          {formatChips(value)}
        </span>
      </div>
      {sidePotCount > 1 && (
        <span className="rounded-full border border-cream/15 bg-ink/70 px-2 py-0.5 text-[9px] font-display uppercase tracking-wider text-cream/50">
          {sidePotCount} pots
        </span>
      )}
    </div>
  );
}
