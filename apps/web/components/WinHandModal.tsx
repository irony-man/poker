'use client';

import { formatChips } from './ChipStack';
import { PlayingCard } from './PlayingCard';
import { useIsNarrow } from '@/lib/tableLayout';

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
  readyCount,
  readyTotal,
  isReady,
  canTopUp,
  canSitOut,
  canSitIn,
  onNextHand,
  onTopUp,
  onSitOut,
  onSitIn,
  onDismiss,
}: {
  winners: WinLine[];
  youWon: boolean;
  canStartNext: boolean;
  readyCount?: number;
  readyTotal?: number;
  isReady?: boolean;
  canTopUp?: boolean;
  canSitOut?: boolean;
  canSitIn?: boolean;
  onNextHand: () => void;
  onTopUp?: () => void;
  onSitOut?: () => void;
  onSitIn?: () => void;
  onDismiss: () => void;
}) {
  const narrow = useIsNarrow();
  const primary = winners[0];
  const winType =
    primary?.handName && primary.handName !== 'Uncontested'
      ? primary.handName
      : winners.length > 1
        ? 'Split pot'
        : 'Won the pot';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="win-hand-title"
        className="flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gold/45 bg-gradient-to-b from-[#1c1810] to-[#0b0906] shadow-[0_0_56px_rgba(224,180,58,0.3)]"
      >
        <div className="shrink-0 border-b border-gold/25 bg-gold/10 px-4 py-3 text-center sm:px-5 sm:py-5">
          <p className="text-[9px] font-display uppercase tracking-[0.28em] text-gold/70 sm:text-[10px]">
            Hand complete
          </p>
          <h2
            id="win-hand-title"
            className="mt-0.5 font-display text-2xl font-extrabold uppercase tracking-wider text-gold sm:mt-1 sm:text-3xl"
          >
            {youWon ? 'You won' : 'Winner'}
          </h2>
          <p className="mt-1.5 inline-block rounded-full border border-gold/40 bg-ink/60 px-2.5 py-0.5 text-xs font-display font-semibold tracking-wide text-gold-light sm:mt-2 sm:px-3 sm:py-1 sm:text-sm">
            {winType}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:space-y-4 sm:px-5 sm:py-5">
          {winners.map((w, i) => {
            const cards = w.cards?.length ? w.cards : [];
            const type =
              w.handName && w.handName !== 'Uncontested' ? w.handName : null;
            return (
              <div
                key={`${w.seat}-${i}`}
                className={`rounded-xl border px-3 py-3 sm:px-4 sm:py-4 ${
                  w.isSelf
                    ? 'border-gold/55 bg-gold/15 shadow-[0_0_24px_rgba(224,180,58,0.15)]'
                    : 'border-cream/10 bg-ink/55'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`truncate font-display text-base font-bold sm:text-lg ${
                      w.isSelf ? 'text-gold' : 'text-cream'
                    }`}
                  >
                    {w.name}
                    {w.isSelf ? ' · you' : ''}
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold text-felt-neon sm:text-base">
                    +{formatChips(w.amount)}
                  </span>
                </div>

                {type && (
                  <p className="mt-1 text-[11px] font-display font-semibold uppercase tracking-wider text-gold/85 sm:mt-1.5 sm:text-sm">
                    {type}
                  </p>
                )}

                {cards.length > 0 ? (
                  narrow ? (
                    <div className="mt-2.5 flex flex-col items-center gap-1">
                      <div className="flex justify-center gap-1">
                        {cards.slice(0, 3).map((code) => (
                          <PlayingCard
                            key={`${w.seat}-${code}`}
                            code={code}
                            highlight
                            size="board"
                          />
                        ))}
                      </div>
                      {cards.length > 3 && (
                        <div className="flex justify-center gap-1">
                          {cards.slice(3).map((code) => (
                            <PlayingCard
                              key={`${w.seat}-${code}`}
                              code={code}
                              highlight
                              size="board"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                      {cards.map((code) => (
                        <PlayingCard
                          key={`${w.seat}-${code}`}
                          code={code}
                          highlight
                          size="sm"
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <p className="mt-2 text-center text-xs text-cream/40">
                    Won without showdown
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-cream/10 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {canTopUp && onTopUp && (
              <button
                type="button"
                onClick={onTopUp}
                className="rounded-md border border-gold/40 bg-gold/15 px-2.5 py-1.5 text-[11px] font-display font-semibold text-gold hover:bg-gold/25"
              >
                Top up
              </button>
            )}
            {canSitOut && onSitOut && (
              <button
                type="button"
                onClick={onSitOut}
                className="rounded-md border border-amber-400/35 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-display font-semibold text-amber-200 hover:bg-amber-400/20"
              >
                Sit out
              </button>
            )}
            {canSitIn && onSitIn && (
              <button
                type="button"
                onClick={onSitIn}
                className="rounded-md border border-felt-neon/35 bg-felt-neon/10 px-2.5 py-1.5 text-[11px] font-display font-semibold text-felt-neon hover:bg-felt-neon/20"
              >
                Sit in
              </button>
            )}
            {canStartNext ? (
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onNextHand}
                  className={`btn-primary min-h-9 flex-1 px-3 py-2 text-xs font-display font-bold uppercase tracking-wide ${
                    isReady ? 'opacity-90 ring-1 ring-felt-neon/50' : ''
                  }`}
                >
                  {isReady ? 'Not ready' : 'Ready'}
                </button>
                {typeof readyCount === 'number' && typeof readyTotal === 'number' && (
                  <span className="shrink-0 text-center text-[10px] font-display uppercase tracking-wider text-cream/50 sm:px-1">
                    {readyCount}/{readyTotal}
                  </span>
                )}
              </div>
            ) : (
              <p className="flex-1 text-center text-[10px] text-cream/45">Waiting…</p>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md border border-cream/20 px-2.5 py-1.5 text-[11px] font-display font-semibold text-cream/70 hover:bg-cream/10 hover:text-cream"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
