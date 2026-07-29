'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/store';
import { useIsLandscapePhone, useIsNarrow } from '@/lib/tableLayout';

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
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();

  const mySeat = table?.players.find((p) => p.userId === userId)?.seat;
  const isTurn = table?.toAct === mySeat && priv;

  const legal = priv?.legal;
  const min = legal?.minRaiseTo ?? 0;
  const max = legal?.maxRaiseTo ?? 0;
  const callAmount = legal?.callAmount ?? 0;
  const bb = table?.config.bigBlind ?? 10;
  const pot = table?.pot ?? 0;

  const [betAmount, setBetAmount] = useState(min);

  useEffect(() => {
    setBetAmount(min);
  }, [min, table?.actionSeq]);

  const shell = bare
    ? 'w-full overflow-hidden'
    : 'hud-panel mx-auto w-full max-w-xl overflow-hidden p-0';

  if (!isTurn || !legal || legal.types.length === 0) {
    return (
      <div
        className={
          bare
            ? 'flex h-full items-center justify-center px-3 text-center text-sm font-medium tracking-wide text-cream/55'
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

  const clampBet = (raw: number) => {
    if (max <= min) return min;
    return snap(Math.min(max, Math.max(min, raw)));
  };

  const setBet = (raw: number) => setBetAmount(clampBet(raw));

  const halfPot = snap(Math.min(max, Math.max(min, Math.floor(pot / 2) + (table?.currentBet ?? 0))));
  const potBet = snap(Math.min(max, Math.max(min, pot + (table?.currentBet ?? 0))));

  const canBet = legal.types.includes('bet') || legal.types.includes('raise');
  const betLabel = legal.types.includes('bet') ? 'Bet' : 'Raise';
  const betAction = legal.types.includes('bet') ? 'bet' : 'raise';
  const amount = clampBet(betAmount);
  const sliderMax = Math.max(min, max);
  const submitBet = (raw: number) => onAction(betAction, clampBet(raw));

  const chipBtn =
    'inline-flex min-h-8 items-center justify-center rounded border border-cream/15 bg-ink-raised px-1.5 text-[10px] font-display font-semibold uppercase tracking-wide hover:border-gold/50 hover:text-gold';
  const actionBtn =
    'inline-flex min-h-10 items-center justify-center px-2 text-[11px] font-display font-bold uppercase tracking-wide';

  /* —— Landscape: one horizontal strip with small text —— */
  if (narrow && landscape) {
    return (
      <div className="flex h-full items-center gap-1 px-1.5">
        {canBet && (
          <>
            <button
              type="button"
              onClick={() => submitBet(amount)}
              className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-gold"
              title={`Confirm ${betLabel.toLowerCase()}`}
            >
              {amount}
            </button>
            <input
              type="range"
              min={min}
              max={sliderMax}
              step={bb}
              value={amount}
              disabled={sliderMax <= min}
              onChange={(e) => setBet(Number(e.target.value))}
              className="bet-slider min-w-0 flex-1"
              aria-label={`${betLabel} amount`}
            />
            <div className="flex shrink-0 gap-0.5">
              {(
                [
                  ['Min', min],
                  ['½', halfPot],
                  ['Pot', potBet],
                  ['Max', max],
                ] as const
              ).map(([label, val]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => submitBet(val)}
                  className={`${chipBtn} min-w-[1.85rem] px-1`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mx-0.5 h-5 w-px shrink-0 bg-cream/15" />
          </>
        )}

        {legal.types.includes('fold') && (
          <button type="button" onClick={() => onAction('fold')} className={`btn-danger ${actionBtn}`}>
            Fold
          </button>
        )}
        {legal.types.includes('check') && (
          <button type="button" onClick={() => onAction('check')} className={`btn-secondary ${actionBtn}`}>
            Check
          </button>
        )}
        {legal.types.includes('call') && (
          <button type="button" onClick={() => onAction('call')} className={`btn-secondary ${actionBtn}`}>
            Call {callAmount}
          </button>
        )}
        {legal.types.includes('allin') && (
          <button type="button" onClick={() => onAction('allin')} className={`btn-primary ${actionBtn}`}>
            All-in
          </button>
        )}
      </div>
    );
  }

  /* —— Portrait mobile: compact text —— */
  if (narrow) {
    return (
      <div className={shell}>
        <div className="space-y-1 p-1.5">
          {canBet && (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-cream/50">
                  {betLabel} to
                </span>
                <button
                  type="button"
                  onClick={() => submitBet(amount)}
                  className="font-mono text-sm font-bold tabular-nums text-gold"
                  title={`Confirm ${betLabel.toLowerCase()}`}
                >
                  {amount}
                  <span className="ml-1.5 text-[9px] font-medium text-cream/40">
                    {min}–{max}
                  </span>
                </button>
              </div>
              <input
                type="range"
                min={min}
                max={sliderMax}
                step={bb}
                value={amount}
                disabled={sliderMax <= min}
                onChange={(e) => setBet(Number(e.target.value))}
                className="bet-slider w-full"
                aria-label={`${betLabel} amount`}
              />
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    ['Min', min],
                    ['½', halfPot],
                    ['Pot', potBet],
                    ['Max', max],
                  ] as const
                ).map(([label, val]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => submitBet(val)}
                    className={chipBtn}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1">
            {legal.types.includes('fold') && (
              <button
                type="button"
                onClick={() => onAction('fold')}
                className={`btn-danger ${actionBtn} min-h-11`}
              >
                Fold
              </button>
            )}
            {legal.types.includes('check') && (
              <button
                type="button"
                onClick={() => onAction('check')}
                className={`btn-secondary ${actionBtn} min-h-11`}
              >
                Check
              </button>
            )}
            {legal.types.includes('call') && (
              <button
                type="button"
                onClick={() => onAction('call')}
                className={`btn-secondary ${actionBtn} min-h-11`}
              >
                Call {callAmount}
              </button>
            )}
            {legal.types.includes('allin') && (
              <button
                type="button"
                onClick={() => onAction('allin')}
                className={`btn-primary ${actionBtn} min-h-11`}
              >
                All-in
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* —— Desktop: full text —— */
  return (
    <div className={shell}>
      <div className="space-y-3 p-4">
        {canBet && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-cream/50">
                {betLabel} to
              </span>
              <button
                type="button"
                onClick={() => submitBet(amount)}
                className="font-mono text-sm font-bold tabular-nums text-gold"
                title={`Confirm ${betLabel.toLowerCase()}`}
              >
                {amount}
                <span className="ml-1.5 text-[9px] font-medium text-cream/40">
                  {min}–{max}
                </span>
              </button>
            </div>
            <input
              type="range"
              min={min}
              max={sliderMax}
              step={bb}
              value={amount}
              disabled={sliderMax <= min}
              onChange={(e) => setBet(Number(e.target.value))}
              className="bet-slider w-full"
              aria-label={`${betLabel} amount`}
            />
            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="sr-only">{betLabel} amount</span>
              <input
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                step={bb}
                value={amount}
                onChange={(e) => setBet(Number(e.target.value) || min)}
                onBlur={() => setBet(amount)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setBet(amount);
                    submitBet(amount);
                  }
                }}
                className="w-full rounded border border-cream/20 bg-ink-raised px-3 py-2 font-mono text-base font-bold tabular-nums text-cream outline-none focus:border-gold/50"
              />
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  ['Min', min],
                  ['½', halfPot],
                  ['Pot', potBet],
                  ['Max', max],
                ] as const
              ).map(([label, val]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => submitBet(val)}
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
            <button type="button" onClick={() => onAction('fold')} className="btn-danger py-2.5 text-sm">
              Fold
            </button>
          )}
          {legal.types.includes('check') && (
            <button type="button" onClick={() => onAction('check')} className="btn-secondary py-2.5 text-sm">
              Check
            </button>
          )}
          {legal.types.includes('call') && (
            <button type="button" onClick={() => onAction('call')} className="btn-secondary py-2.5 text-sm">
              Call {callAmount}
            </button>
          )}
          {legal.types.includes('allin') && (
            <button type="button" onClick={() => onAction('allin')} className="btn-primary py-2.5 text-sm">
              All-in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
