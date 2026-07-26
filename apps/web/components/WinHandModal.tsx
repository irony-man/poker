'use client';

import { formatChips } from './ChipStack';
import { PlayingCard } from './PlayingCard';

export type WinLine = {
  seat: number;
  name: string;
  amount: number;
  handName?: string;
  cards?: string[];
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
  const primary = winners[0];
  const winType =
    primary?.handName && primary.handName !== 'Uncontested'
      ? primary.handName
      : winners.length > 1
        ? 'Split pot'
        : 'Won the pot';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="win-hand-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-gold/45 bg-gradient-to-b from-[#1c1810] to-[#0b0906] shadow-[0_0_56px_rgba(224,180,58,0.3)]"
      >
        <div className="border-b border-gold/25 bg-gold/10 px-5 py-5 text-center">
          <p className="text-[10px] font-display uppercase tracking-[0.28em] text-gold/70">
            Hand complete
          </p>
          <h2
            id="win-hand-title"
            className="mt-1 font-display text-3xl font-extrabold uppercase tracking-wider text-gold"
          >
            {youWon ? 'You won' : 'Winner'}
          </h2>
          <p className="mt-2 inline-block rounded-full border border-gold/40 bg-ink/60 px-3 py-1 text-sm font-display font-semibold tracking-wide text-gold-light">
            {winType}
          </p>
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-5 py-5">
          {winners.map((w, i) => {
            const cards = w.cards?.length ? w.cards : [];
            const type =
              w.handName && w.handName !== 'Uncontested' ? w.handName : null;
            return (
              <div
                key={`${w.seat}-${i}`}
                className={`rounded-xl border px-4 py-4 ${
                  w.isSelf
                    ? 'border-gold/55 bg-gold/15 shadow-[0_0_24px_rgba(224,180,58,0.15)]'
                    : 'border-cream/10 bg-ink/55'
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

                {type && (
                  <p className="mt-1.5 text-sm font-display font-semibold uppercase tracking-wider text-gold/85">
                    {type}
                  </p>
                )}

                {cards.length > 0 ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {cards.map((code) => (
                      <PlayingCard
                        key={`${w.seat}-${code}`}
                        code={code}
                        highlight
                        small
                      />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-center text-xs text-cream/40">
                    Won without showdown
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-cream/10 px-5 py-4">
          {canStartNext ? (
            <button type="button" onClick={onNextHand} className="btn-primary w-full py-3 text-base">
              Next Hand
            </button>
          ) : (
            <p className="py-2 text-center text-xs text-cream/45">
              Waiting for the next hand…
            </p>
          )}
          <button type="button" onClick={onDismiss} className="btn-ghost w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
