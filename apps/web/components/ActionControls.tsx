'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/store';

export function ActionControls({
  onAction,
}: {
  onAction: (action: string, amount?: number) => void;
}) {
  const table = useSession((s) => s.table);
  const priv = useSession((s) => s.private);
  const userId = useSession((s) => s.userId);

  const mySeat = table?.players.find((p) => p.userId === userId)?.seat;
  const isTurn = table?.toAct === mySeat && priv;

  const legal = priv?.legal;
  const min = legal?.minRaiseTo ?? 0;
  const max = legal?.maxRaiseTo ?? 0;
  const callAmount = legal?.callAmount ?? 0;
  const bb = table?.config.bigBlind ?? 10;
  const pot = table?.pot ?? 0;

  const [raiseTo, setRaiseTo] = useState(min);

  useEffect(() => {
    setRaiseTo(min);
  }, [min, table?.actionSeq]);

  if (!isTurn || !legal || legal.types.length === 0) {
    return (
      <div className="rounded-xl bg-ink/70 border border-cream/10 px-4 py-3 text-sm text-cream/60 text-center">
        {table?.street === 'waiting'
          ? 'Waiting for players…'
          : table?.toAct !== mySeat
            ? 'Waiting for your turn…'
            : '—'}
      </div>
    );
  }

  const snap = (v: number) => Math.round(v / bb) * bb;

  const halfPot = snap(Math.min(max, Math.max(min, Math.floor(pot / 2) + (table?.currentBet ?? 0))));
  const potBet = snap(Math.min(max, Math.max(min, pot + (table?.currentBet ?? 0))));

  return (
    <div className="w-full max-w-xl mx-auto space-y-3">
      {(legal.types.includes('bet') || legal.types.includes('raise')) && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-cream/70">
            <span>Raise to {raiseTo}</span>
            <span>
              {min} – {max}
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={bb}
            value={Math.min(max, Math.max(min, raiseTo))}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
            className="w-full accent-gold"
          />
          <div className="grid grid-cols-4 gap-2">
            {[
              ['Min', min],
              ['½ Pot', halfPot],
              ['Pot', potBet],
              ['Max', max],
            ].map(([label, val]) => (
              <button
                key={label as string}
                type="button"
                onClick={() => setRaiseTo(val as number)}
                className="rounded-md bg-cream/10 py-1.5 text-xs hover:bg-cream/20"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {legal.types.includes('fold') && (
          <button
            type="button"
            onClick={() => onAction('fold')}
            className="rounded-lg bg-red-900/80 py-3 font-semibold hover:bg-red-800"
          >
            Fold
          </button>
        )}
        {legal.types.includes('check') && (
          <button
            type="button"
            onClick={() => onAction('check')}
            className="rounded-lg bg-cream/15 py-3 font-semibold hover:bg-cream/25"
          >
            Check
          </button>
        )}
        {legal.types.includes('call') && (
          <button
            type="button"
            onClick={() => onAction('call')}
            className="rounded-lg bg-cream/15 py-3 font-semibold hover:bg-cream/25"
          >
            Call {callAmount}
          </button>
        )}
        {(legal.types.includes('bet') || legal.types.includes('raise')) && (
          <button
            type="button"
            onClick={() => onAction(legal.types.includes('bet') ? 'bet' : 'raise', raiseTo)}
            className="rounded-lg bg-gold text-ink py-3 font-semibold hover:bg-gold-light col-span-1"
          >
            {legal.types.includes('bet') ? 'Bet' : 'Raise'} {raiseTo}
          </button>
        )}
      </div>
    </div>
  );
}
