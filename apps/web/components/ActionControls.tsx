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
    ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden text-ink-strong'
    : 'hud-panel mx-auto w-full max-w-xl overflow-hidden p-0';

  if (!isTurn || !legal || legal.types.length === 0) {
    const copy = waitingCopy({
      spectating,
      street: table?.street,
      isTurn: false,
      mySeat,
      toAct: table?.toAct,
      connection: connectionOpen ? 'open' : 'closed',
    });
    return (
      <div
        className={
          bare
            ? 'flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-1.5 px-3 py-2 text-center'
            : 'hud-panel flex min-h-[160px] flex-col items-center justify-center gap-1.5 px-3 py-3 text-center'
        }
        role="status"
        aria-live="polite"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- public animated SVG loader */}
        <img
          src="/poker-chip-shuffle.svg"
          alt=""
          width={64}
          height={64}
          className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
          aria-hidden
          decoding="async"
        />
        <p className="max-w-[16rem] text-xs font-medium leading-snug tracking-wide text-ink-strong-muted sm:text-sm">
          {copy}
        </p>
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
        <div className="flex h-full min-h-0 flex-1 flex-col justify-center space-y-3 p-3 sm:p-4">
          <p className="text-center text-sm font-medium text-ink-strong">
            Confirm <span className="font-bold text-sidebar">{confirm.label}</span>?
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
    'inline-flex min-h-8 items-center justify-center rounded-md border border-sidebar/18 bg-white px-1.5 text-[10px] font-display font-semibold uppercase tracking-wide text-ink-strong hover:border-sidebar/40 hover:bg-sidebar/8 hover:text-sidebar';
  const actionBtn =
    'inline-flex min-h-10 items-center justify-center px-2 text-[11px] font-display font-bold uppercase tracking-wide';
  const softAction =
    'inline-flex min-h-10 items-center justify-center rounded border border-sidebar/20 bg-white px-2 text-[11px] font-display font-bold uppercase tracking-wide text-sidebar shadow-[0_2px_8px_rgb(29_4_50/0.06)] hover:border-sidebar/35 hover:bg-sidebar/5';

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

  /* —— Landscape: sized strip + three wide actions —— */
  if (narrow && landscape) {
    const landBtn =
      'inline-flex min-h-[2.75rem] flex-1 items-center justify-center rounded-lg border border-sidebar/20 bg-white px-2 text-[13px] font-bold tracking-wide text-sidebar shadow-[0_2px_8px_rgb(29_4_50/0.08)] active:bg-sidebar/8';
    const midLabel = legal.types.includes('check')
      ? 'Check'
      : legal.types.includes('call')
        ? `Call ${callAmount}`
        : null;
    const thirdIsBet = canBet;
    const thirdIsAllin = !canBet && legal.types.includes('allin');

    return (
      <div className="flex h-full min-h-0 flex-col text-ink-strong">
        {timer}
        {canBet && (
          <div className="flex shrink-0 items-center gap-1 border-b border-sidebar/12 px-1.5 py-0.5">
            <span className="shrink-0 font-serif text-sm font-normal tabular-nums text-sidebar">
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
                  className="rounded border border-sidebar/18 bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-strong hover:bg-sidebar/8"
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
              className={`${landBtn} border-danger/35 bg-danger text-cream hover:brightness-110`}
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
            <button
              type="button"
              onClick={() => submitBet(amount)}
              className={`${landBtn} border-sidebar/30 bg-gradient-to-b from-[#341252] to-sidebar text-mushroom`}
            >
              {betLabel}
            </button>
          ) : thirdIsAllin ? (
            <button
              type="button"
              onClick={() => commit('allin', undefined, 'All-in')}
              className={`${landBtn} border-sidebar/30 bg-gradient-to-b from-[#341252] to-sidebar text-mushroom`}
            >
              All-in
            </button>
          ) : legal.types.includes('allin') ? (
            <button
              type="button"
              onClick={() => commit('allin', undefined, 'All-in')}
              className={`${landBtn} border-sidebar/30 bg-gradient-to-b from-[#341252] to-sidebar text-mushroom`}
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
        <div className="flex min-h-0 flex-1 flex-col justify-between space-y-1 p-1.5">
          {canBet && (
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-strong-muted">
                  {betLabel} to
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-sidebar">
                  {amount}
                  <span className="ml-1.5 text-[10px] font-medium text-ink-strong-muted">
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
                className={`${softAction} min-h-11`}
              >
                Check
              </button>
            )}
            {legal.types.includes('call') && (
              <button
                type="button"
                onClick={() => commit('call')}
                className={`${softAction} min-h-11`}
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

  /* —— Desktop: fill fixed 160px dock —— */
  return (
    <div className={shell}>
      <MoveTimerStrip endsAt={turnEndsAt} totalMs={turnTotalMs} compact />
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 px-3 pb-2 pt-1">
        {canBet && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-strong-muted">
                {betLabel} to
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-sidebar">
                {amount}
                <span className="ml-1.5 text-[10px] font-medium text-ink-strong-muted">
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
            <div className="grid grid-cols-[minmax(4.5rem,1fr)_repeat(4,minmax(0,1fr))] gap-1">
              <label className="min-w-0">
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
                  className="w-full rounded border border-sidebar/18 bg-white px-2 py-1.5 font-mono text-sm font-bold tabular-nums text-ink-strong outline-none focus:border-sidebar/45 focus:shadow-[0_0_0_2px_rgb(29_4_50/0.08)]"
                />
              </label>
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
                  className="rounded border border-sidebar/18 bg-white px-1 py-1.5 text-[10px] font-display font-semibold uppercase tracking-wide text-ink-strong hover:border-sidebar/40 hover:bg-sidebar/8 hover:text-sidebar"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`grid gap-1.5 ${canBet ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {legal.types.includes('fold') && (
            <button
              type="button"
              onClick={() => commit('fold', undefined, 'Fold')}
              className="btn-danger !rounded py-2 text-xs"
            >
              Fold
            </button>
          )}
          {legal.types.includes('check') && (
            <button
              type="button"
              onClick={() => commit('check')}
              className={`${softAction} min-h-9 py-2 text-xs`}
            >
              Check
            </button>
          )}
          {legal.types.includes('call') && (
            <button
              type="button"
              onClick={() => commit('call')}
              className={`${softAction} min-h-9 py-2 text-xs`}
            >
              Call {callAmount}
            </button>
          )}
          {canBet && (
            <button
              type="button"
              onClick={() => submitBet(amount)}
              className="btn-primary !rounded py-2 text-xs"
            >
              {betLabel} {amount}
            </button>
          )}
          {legal.types.includes('allin') && (
            <button
              type="button"
              onClick={() => commit('allin', undefined, 'All-in')}
              className="btn-primary !rounded py-2 text-xs"
            >
              All-in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
