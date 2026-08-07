'use client';

import { useEffect, useState } from 'react';
import { MoveTimerStrip } from './TurnTimer';
import { useSession } from '@/lib/store';
import { useIsLandscapePhone, useIsNarrow } from '@/lib/tableLayout';

function waitingCopy(opts: {
  spectating: boolean;
  street: string | undefined;
  isTurn: boolean;
  mySeat: number | undefined;
  toAct: number | null | undefined;
  connection?: string;
}): string {
  if (opts.connection && opts.connection !== 'open') {
    return opts.connection === 'connecting' ? 'Reconnecting…' : 'Disconnected — actions paused';
  }
  if (opts.spectating) return 'Spectating — you are not seated';
  if (opts.street === 'waiting') return 'Waiting for players…';
  if (opts.street === 'payout' || opts.street === 'showdown') return 'Hand complete — start next when ready';
  if (!opts.isTurn) return 'Waiting for your turn…';
  return '—';
}

export function ActionControls({
  onAction,
  spectating = false,
  bare = false,
  connectionOpen = true,
}: {
  onAction: (action: string, amount?: number) => void;
  spectating?: boolean;
  /** Skip outer hud-panel chrome (when nested in FloatingActionDock). */
  bare?: boolean;
  /** When false, block commits and show reconnect copy. */
  connectionOpen?: boolean;
}) {
  const table = useSession((s) => s.table);
  const priv = useSession((s) => s.private);
  const userId = useSession((s) => s.userId);
  const narrow = useIsNarrow();
  const landscape = useIsLandscapePhone();

  const mySeat = table?.players.find((p) => p.userId === userId)?.seat;
  const myStack = table?.players.find((p) => p.userId === userId)?.stack ?? 0;
  const isTurn = connectionOpen && table?.toAct === mySeat && !!priv;
  const turnEndsAt = isTurn ? table?.turnEndsAt : null;
  const turnTotalMs = table?.config.turnTimeMs ?? 20_000;

  const legal = priv?.legal;
  const min = legal?.minRaiseTo ?? 0;
  const max = legal?.maxRaiseTo ?? 0;
  const callAmount = legal?.callAmount ?? 0;
  const bb = table?.config.bigBlind ?? 10;
  const pot = table?.pot ?? 0;

  const [betAmount, setBetAmount] = useState(min);
  const [confirm, setConfirm] = useState<null | { action: string; amount?: number; label: string }>(
    null,
  );

  useEffect(() => {
    setBetAmount(min);
    setConfirm(null);
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
        {waitingCopy({
          spectating,
          street: table?.street,
          isTurn: false,
          mySeat,
          toAct: table?.toAct,
          connection: connectionOpen ? 'open' : 'closed',
        })}
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

  /** Large commitments need an extra confirm tap. */
  const needsConfirm = (action: string, amt?: number) => {
    if (action === 'allin') return true;
    if (action === 'fold' && callAmount > 0 && callAmount >= myStack * 0.4) return true;
    if ((action === 'bet' || action === 'raise') && amt != null && myStack > 0 && amt >= myStack * 0.5) {
      return true;
    }
    return false;
  };

  const commit = (action: string, amt?: number, label?: string) => {
    if (!connectionOpen) return;
    if (needsConfirm(action, amt)) {
      setConfirm({
        action,
        amount: amt,
        label: label ?? action,
      });
      return;
    }
    onAction(action, amt);
  };

  const submitBet = (raw: number) => {
    const v = clampBet(raw);
    commit(betAction, v, `${betLabel} ${v}`);
  };

  if (confirm) {
    return (
      <div className={shell}>
        <div className="space-y-3 p-3 sm:p-4">
          <p className="text-center text-sm font-medium text-cream">
            Confirm <span className="font-bold text-brass-light">{confirm.label}</span>?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-ghost min-h-11"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary min-h-11"
              onClick={() => {
                onAction(confirm.action, confirm.amount);
                setConfirm(null);
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  const chipBtn =
    'inline-flex min-h-8 items-center justify-center rounded border border-cream/15 bg-ink-raised px-1.5 text-[10px] font-display font-semibold uppercase tracking-wide hover:border-brass/50 hover:text-brass-light';
  const actionBtn =
    'inline-flex min-h-10 items-center justify-center px-2 text-[11px] font-display font-bold uppercase tracking-wide';

  const timer = (
    <MoveTimerStrip endsAt={turnEndsAt} totalMs={turnTotalMs} compact={!!(narrow && landscape)} />
  );

  const presets = (
    <>
      {(
        [
          ['Min', min],
          ['½', halfPot],
          ['Pot', potBet],
          ['Max', max],
        ] as const
      ).map(([label, val]) => (
        <button key={label} type="button" onClick={() => setBet(val)} className={chipBtn}>
          {label}
        </button>
      ))}
    </>
  );

  /* —— Landscape: reference strip — size row + three wide black actions —— */
  if (narrow && landscape) {
    const landBtn =
      'inline-flex min-h-[2.75rem] flex-1 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-b from-[#2a2a2a] to-black px-2 text-[13px] font-bold tracking-wide text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] active:from-[#1a1a1a] active:to-[#050505]';
    const midLabel = legal.types.includes('check')
      ? 'Check'
      : legal.types.includes('call')
        ? `Call ${callAmount}`
        : null;
    const thirdIsBet = canBet;
    const thirdIsAllin = !canBet && legal.types.includes('allin');

    return (
      <div className="flex h-full min-h-0 flex-col">
        {timer}
        {canBet && (
          <div className="flex shrink-0 items-center gap-1 border-b border-white/10 px-1.5 py-0.5">
            <span className="shrink-0 font-serif text-sm font-normal tabular-nums text-white">
              ${amount}
            </span>
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
                  onClick={() => setBet(val)}
                  className="rounded border border-white/15 bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/80"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex min-h-0 flex-1 items-stretch gap-1.5 px-1.5 py-1">
          {legal.types.includes('fold') ? (
            <button
              type="button"
              onClick={() => commit('fold', undefined, 'Fold')}
              className={landBtn}
            >
              Fold
            </button>
          ) : (
            <div className="flex-1" />
          )}
          {midLabel ? (
            <button
              type="button"
              onClick={() =>
                legal.types.includes('check') ? commit('check') : commit('call')
              }
              className={landBtn}
            >
              {midLabel}
            </button>
          ) : (
            <div className="flex-1" />
          )}
          {thirdIsBet ? (
            <button type="button" onClick={() => submitBet(amount)} className={landBtn}>
              {betLabel}
            </button>
          ) : thirdIsAllin ? (
            <button
              type="button"
              onClick={() => commit('allin', undefined, 'All-in')}
              className={landBtn}
            >
              All-in
            </button>
          ) : legal.types.includes('allin') ? (
            <button
              type="button"
              onClick={() => commit('allin', undefined, 'All-in')}
              className={landBtn}
            >
              All-in
            </button>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    );
  }

  /* —— Portrait mobile: compact text —— */
  if (narrow) {
    return (
      <div className={shell}>
        {timer}
        <div className="space-y-1 p-1.5">
          {canBet && (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cream-muted">
                  {betLabel} to
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-brass">
                  {amount}
                  <span className="ml-1.5 text-[10px] font-medium text-cream-muted">
                    {min}–{max}
                  </span>
                </span>
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
              <div className="grid grid-cols-4 gap-1">{presets}</div>
            </div>
          )}

          <div className={`grid gap-1 ${canBet ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {legal.types.includes('fold') && (
              <button
                type="button"
                onClick={() => commit('fold', undefined, 'Fold')}
                className={`btn-danger ${actionBtn} min-h-11`}
              >
                Fold
              </button>
            )}
            {legal.types.includes('check') && (
              <button
                type="button"
                onClick={() => commit('check')}
                className={`btn-secondary ${actionBtn} min-h-11`}
              >
                Check
              </button>
            )}
            {legal.types.includes('call') && (
              <button
                type="button"
                onClick={() => commit('call')}
                className={`btn-secondary ${actionBtn} min-h-11`}
              >
                Call {callAmount}
              </button>
            )}
            {canBet && (
              <button
                type="button"
                onClick={() => submitBet(amount)}
                className={`btn-primary ${actionBtn} min-h-11`}
              >
                {betLabel} {amount}
              </button>
            )}
            {legal.types.includes('allin') && (
              <button
                type="button"
                onClick={() => commit('allin', undefined, 'All-in')}
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
      {timer}
      <div className="space-y-3 p-4">
        {canBet && (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cream-muted">
                {betLabel} to
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-brass">
                {amount}
                <span className="ml-1.5 text-[10px] font-medium text-cream-muted">
                  {min}–{max}
                </span>
              </span>
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
                className="w-full rounded border border-cream/20 bg-ink-raised px-3 py-2 font-mono text-base font-bold tabular-nums text-cream outline-none focus:border-brass/50"
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
                  onClick={() => setBet(val)}
                  className="rounded border border-cream/15 bg-ink-raised py-1.5 text-[11px] font-display font-semibold uppercase tracking-wide hover:border-brass/50 hover:text-brass-light"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`grid gap-2 ${canBet ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {legal.types.includes('fold') && (
            <button
              type="button"
              onClick={() => commit('fold', undefined, 'Fold')}
              className="btn-danger py-2.5 text-sm"
            >
              Fold
            </button>
          )}
          {legal.types.includes('check') && (
            <button type="button" onClick={() => commit('check')} className="btn-secondary py-2.5 text-sm">
              Check
            </button>
          )}
          {legal.types.includes('call') && (
            <button type="button" onClick={() => commit('call')} className="btn-secondary py-2.5 text-sm">
              Call {callAmount}
            </button>
          )}
          {canBet && (
            <button type="button" onClick={() => submitBet(amount)} className="btn-primary py-2.5 text-sm">
              {betLabel} {amount}
            </button>
          )}
          {legal.types.includes('allin') && (
            <button
              type="button"
              onClick={() => commit('allin', undefined, 'All-in')}
              className="btn-primary py-2.5 text-sm"
            >
              All-in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
