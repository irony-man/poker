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
          <span className="table-chrome-disc table-chrome-disc-ring flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ring-2">
            D
          </span>
          {dealerName ? (
            <span className="table-label-on-felt max-w-[6.5rem] truncate text-[9px] font-semibold uppercase tracking-wide">
              {dealerName}
            </span>
          ) : null}
        </div>
      )}
      <PotBanner amount={amount} sidePotCount={sidePotCount} landscape={landscape} />
    </div>
  );
}
