'use client';

import { useEffect, useState } from 'react';
import { MoveTimerStrip, useMoveTimerLabel } from './TurnTimer';
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
  const turnEndsAt = table?.turnEndsAt;
  const turnTimeMs = table?.config.turnTimeMs ?? 20_000;
  const { label: timerLabel, urgent } = useMoveTimerLabel(isTurn ? turnEndsAt : null);

  const [raiseTo, setRaiseTo] = useState(min);

  useEffect(() => {
    setRaiseTo(min);
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

  const halfPot = snap(Math.min(max, Math.max(min, Math.floor(pot / 2) + (table?.currentBet ?? 0))));
  const potBet = snap(Math.min(max, Math.max(min, pot + (table?.currentBet ?? 0))));

  return (
    <div className={shell}>
      <MoveTimerStrip endsAt={turnEndsAt} totalMs={turnTimeMs} />
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-display uppercase tracking-[0.2em] text-felt-neon">
            Your move
          </span>
          <div className="flex items-center gap-2">
            {timerLabel && (
              <span
                className={`font-mono text-sm font-bold tabular-nums ${
                  urgent ? 'text-red-300' : 'text-cream/75'
                }`}
              >
                {timerLabel}
              </span>
            )}
            <span className="h-2 w-2 rounded-full bg-felt-neon animate-live-blink shadow-glow-neon" />
          </div>
        </div>

        {(legal.types.includes('bet') || legal.types.includes('raise')) && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-cream/70">
              <span>Raise to {raiseTo}</span>
              <span className="text-cream/40">
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
          {(legal.types.includes('bet') || legal.types.includes('raise')) && (
            <button
              type="button"
              onClick={() => onAction(legal.types.includes('bet') ? 'bet' : 'raise', raiseTo)}
              className="btn-primary col-span-1"
            >
              {legal.types.includes('bet') ? 'Bet' : 'Raise'} {raiseTo}
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
