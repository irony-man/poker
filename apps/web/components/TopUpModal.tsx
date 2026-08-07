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
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-overlay/70 p-4 sm:items-center">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-mushroom/20 bg-ink-panel p-5 shadow-panel"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(amount);
        }}
      >
        <h3 className="font-display text-xl font-bold uppercase tracking-wide text-mushroom">
          Top up
        </h3>
        <p className="text-sm text-cream/60">
          Stack ${formatChips(currentStack)} · table buy-in ${formatChips(buyIn)}
        </p>
        <p className="rounded-lg border border-mushroom/25 bg-mushroom/10 px-3 py-3 text-center text-sm text-mushroom">
          Add ${formatChips(amount)} to reach ${formatChips(buyIn)}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onDismiss} className="btn-ghost flex-1 py-2">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1 py-2">
            Top up ${formatChips(amount)}
          </button>
        </div>
      </form>
    </div>
  );
}
