'use client';

import { formatChips } from './ChipStack';

export type WinLine = {
  seat: number;
  name: string;
  amount: number;
  handName?: string;
  isSelf?: boolean;
};

export function WinHandModal({
  winners,
  youWon,
  canStartNext,
  onNextHand,
  onDismiss,
}: {
  winners: WinLine[];
  youWon: boolean;
  canStartNext: boolean;
  onNextHand: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="win-hand-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-b from-[#1a1610] to-[#0c0a08] shadow-[0_0_48px_rgba(224,180,58,0.25)]"
      >
        <div className="border-b border-gold/20 bg-gold/10 px-5 py-4 text-center">
          <p className="text-[10px] font-display uppercase tracking-[0.28em] text-gold/70">
            Hand complete
          </p>
          <h2
            id="win-hand-title"
            className="mt-1 font-display text-2xl font-extrabold uppercase tracking-wider text-gold"
          >
            {youWon ? 'You won' : 'Winner'}
          </h2>
        </div>

        <div className="space-y-3 px-5 py-5">
          {winners.map((w, i) => (
            <div
              key={`${w.seat}-${i}`}
              className={`rounded-xl border px-4 py-3 ${
                w.isSelf
                  ? 'border-gold/50 bg-gold/15'
                  : 'border-cream/10 bg-ink/50'
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={`font-display text-lg font-bold ${
                    w.isSelf ? 'text-gold' : 'text-cream'
                  }`}
                >
                  {w.name}
                  {w.isSelf ? ' · you' : ''}
                </span>
                <span className="font-mono text-base font-semibold text-felt-neon">
                  +{formatChips(w.amount)}
                </span>
              </div>
              {w.handName && w.handName !== 'Uncontested' && (
                <p className="mt-1 text-sm text-cream/55">{w.handName}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-cream/10 px-5 py-4 sm:flex-row">
          {canStartNext ? (
            <button type="button" onClick={onNextHand} className="btn-primary flex-1">
              Next hand
            </button>
          ) : (
            <p className="flex-1 self-center text-center text-xs text-cream/45">
              Waiting for the next hand…
            </p>
          )}
          <button type="button" onClick={onDismiss} className="btn-ghost flex-1">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
