'use client';

import { PotBanner } from './PotBanner';

/** Reserved top-of-table zone: dealer button and center pot. */
export function DealerPotZone({
  amount,
  sidePotCount = 0,
  dealerName,
  showDealer = false,
  landscape = false,
}: {
  amount: number;
  sidePotCount?: number;
  dealerName?: string | null;
  showDealer?: boolean;
  landscape?: boolean;
}) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-1.5">
      {showDealer && !landscape && (
        <div className="flex flex-col items-center gap-0.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c62828] text-xs font-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] ring-2 ring-white/80">
            D
          </span>
          {dealerName ? (
            <span className="max-w-[6.5rem] truncate text-[9px] font-semibold uppercase tracking-wide text-white/75">
              {dealerName}
            </span>
          ) : null}
        </div>
      )}
      <PotBanner amount={amount} sidePotCount={sidePotCount} landscape={landscape} />
    </div>
  );
}
