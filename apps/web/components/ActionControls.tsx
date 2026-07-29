'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/store';

export function ActionControls({
  onAction,
  spectating = false,
  bare = false,
}: {
  onAction: (action: string, amount?: number) => void;
  spectating?: boolean;
  /** Skip outer hud-panel chrome (when nested in FloatingActionDock). */
  bare?: boolean;
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

  const [betInput, setBetInput] = useState(String(min));

  useEffect(() => {
    setBetInput(String(min));
  }, [min, table?.actionSeq]);

  const shell = bare
    ? 'w-full overflow-hidden'
    : 'hud-panel mx-auto w-full max-w-xl overflow-hidden p-0';

  if (!isTurn || !legal || legal.types.length === 0) {
    return (
      <div
        className={
          bare
            ? 'px-4 py-3 text-center text-sm font-medium tracking-wide text-cream/55'
            : 'hud-panel px-4 py-3 text-center text-sm font-medium tracking-wide text-cream/55'
        }
      >
        {spectating
          ? 'Spectating — you are not seated'
          : table?.street === 'waiting'
            ? 'Waiting for players…'
            : table?.toAct !== mySeat
              ? 'Waiting for your turn…'
              : '—'}
      </div>
    );
  }

  const snap = (v: number) => Math.round(v / bb) * bb;

  const clampBet = (raw: number) => snap(Math.min(max, Math.max(min, raw)));

  const parseBetInput = () => clampBet(Number(betInput) || min);

  const commitBetInput = () => setBetInput(String(parseBetInput()));

  const halfPot = snap(Math.min(max, Math.max(min, Math.floor(pot / 2) + (table?.currentBet ?? 0))));
  const potBet = snap(Math.min(max, Math.max(min, pot + (table?.currentBet ?? 0))));

  const canBet = legal.types.includes('bet') || legal.types.includes('raise');
  const betLabel = legal.types.includes('bet') ? 'Bet' : 'Raise';

  return (
    <div className={shell}>
      <div className="space-y-3 p-4">
        <span className="text-[10px] font-display uppercase tracking-[0.2em] text-felt-neon">
          Your move
        </span>

        {canBet && (
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cream/50">
                  {betLabel} to
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={min}
                  max={max}
                  step={bb}
                  value={betInput}
                  onChange={(e) => setBetInput(e.target.value)}
                  onBlur={commitBetInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitBetInput();
                      onAction(legal.types.includes('bet') ? 'bet' : 'raise', parseBetInput());
                    }
                  }}
                  className="w-full rounded border border-cream/20 bg-ink-raised px-3 py-2 font-mono text-base font-bold tabular-nums text-cream outline-none focus:border-gold/50"
                />
              </label>
              <span className="shrink-0 pb-2 text-[10px] font-medium text-cream/40">
                {min} – {max}
              </span>
            </div>
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
                  onClick={() => setBetInput(String(val))}
                  className="rounded border border-cream/15 bg-ink-raised py-1.5 text-[11px] font-display font-semibold uppercase tracking-wide hover:border-gold/50 hover:text-gold"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {legal.types.includes('fold') && (
            <button type="button" onClick={() => onAction('fold')} className="btn-danger">
              Fold
            </button>
          )}
          {legal.types.includes('check') && (
            <button type="button" onClick={() => onAction('check')} className="btn-secondary">
              Check
            </button>
          )}
          {legal.types.includes('call') && (
            <button type="button" onClick={() => onAction('call')} className="btn-secondary">
              Call {callAmount}
            </button>
          )}
          {canBet && (
            <button
              type="button"
              onClick={() => onAction(legal.types.includes('bet') ? 'bet' : 'raise', parseBetInput())}
              className="btn-primary col-span-1"
            >
              {betLabel} {parseBetInput()}
            </button>
          )}
          {legal.types.includes('allin') && (
            <button type="button" onClick={() => onAction('allin')} className="btn-primary">
              All-in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
