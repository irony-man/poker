'use client';

import { formatChips } from './ChipStack';

export function TopUpModal({
  currentStack,
  buyIn,
  onConfirm,
  onDismiss,
}: {
  currentStack: number;
  buyIn: number;
  onConfirm: (amount: number) => void;
  onDismiss: () => void;
}) {
  const amount = Math.max(0, buyIn - currentStack);
  if (amount <= 0) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-cream/15 bg-[#161310] p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(amount);
        }}
      >
        <h3 className="font-display text-xl">Top up</h3>
        <p className="text-sm text-cream/60">
          Stack ${formatChips(currentStack)} · table buy-in ${formatChips(buyIn)}
        </p>
        <p className="rounded-lg border border-gold/25 bg-gold/10 px-3 py-3 text-center text-sm text-gold">
          Add ${formatChips(amount)} to reach ${formatChips(buyIn)}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onDismiss} className="flex-1 rounded-lg bg-cream/10 py-2">
            Cancel
          </button>
          <button type="submit" className="flex-1 rounded-lg bg-gold py-2 font-semibold text-ink">
            Top up ${formatChips(amount)}
          </button>
        </div>
      </form>
    </div>
  );
}
