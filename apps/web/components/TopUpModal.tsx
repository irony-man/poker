'use client';

import { useMemo, useState } from 'react';
import { formatChips } from './ChipStack';

export function TopUpModal({
  currentStack,
  minBuyIn,
  maxBuyIn,
  onConfirm,
  onDismiss,
}: {
  currentStack: number;
  minBuyIn: number;
  maxBuyIn: number;
  onConfirm: (amount: number) => void;
  onDismiss: () => void;
}) {
  const headroom = Math.max(0, maxBuyIn - currentStack);
  const [amount, setAmount] = useState(headroom);

  const step = useMemo(() => Math.max(1, Math.min(minBuyIn, headroom)), [minBuyIn, headroom]);
  const canTopUp = headroom > 0;

  if (!canTopUp) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-cream/15 bg-[#161310] p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (amount > 0) onConfirm(amount);
        }}
      >
        <h3 className="font-display text-xl">Top up</h3>
        <p className="text-sm text-cream/60">
          Stack ${formatChips(currentStack)} · table max ${formatChips(maxBuyIn)}
        </p>
        <label className="block text-sm text-cream/70">
          Add chips (up to ${formatChips(headroom)})
          <input
            type="range"
            min={step}
            max={headroom}
            step={step}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-2 w-full accent-gold"
          />
          <input
            type="number"
            min={step}
            max={headroom}
            step={step}
            value={amount}
            onChange={(e) =>
              setAmount(Math.min(headroom, Math.max(step, Number(e.target.value) || step)))
            }
            className="mt-2 w-full rounded-md border border-cream/15 bg-cream/5 px-3 py-2 tabular-nums"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAmount(headroom)}
            className="rounded-lg border border-cream/20 px-3 py-2 text-xs text-cream/80 hover:bg-cream/10"
          >
            Fill to max
          </button>
          <button type="button" onClick={onDismiss} className="flex-1 rounded-lg bg-cream/10 py-2">
            Cancel
          </button>
          <button type="submit" className="flex-1 rounded-lg bg-gold py-2 font-semibold text-ink">
            Add ${formatChips(amount)}
          </button>
        </div>
      </form>
    </div>
  );
}
