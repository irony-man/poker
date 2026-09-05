'use client';

import { Button } from '@/components/ui/Button';
import { ReadyPlayersRoster, type ReadyRosterPlayer } from '@/components/WinHandModal';
import { ludoColorForSeat, ludoHexForSeat } from '@/lib/ludoBoard';
import { cn } from '@/lib/cn';

export function LudoWinModal({
  winnerName,
  winnerSeat,
  youWon,
  canReady,
  isReady,
  readyPlayers,
  readyCount,
  readyTotal,
  onReady,
  onDismiss,
}: {
  winnerName: string;
  winnerSeat: number;
  youWon: boolean;
  canReady: boolean;
  isReady: boolean;
  readyPlayers: ReadyRosterPlayer[];
  readyCount: number;
  readyTotal: number;
  onReady: () => void;
  onDismiss: () => void;
}) {
  const color = ludoColorForSeat(winnerSeat);
  const hex = ludoHexForSeat(winnerSeat);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-overlay/55 p-3 backdrop-blur-[3px] sm:items-center sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-lg flex-col items-stretch gap-3 sm:gap-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ludo-win-title"
          className="surface-modal flex max-h-[min(78dvh,36rem)] w-full flex-col"
        >
          <div className="shrink-0 border-b border-sidebar/10 bg-white px-4 py-3 text-center sm:px-5 sm:py-5">
            <p className="text-[9px] font-display uppercase tracking-[0.28em] text-ink-strong-muted sm:text-[10px]">
              Match complete
            </p>
            <h2
              id="ludo-win-title"
              className="mt-0.5 font-display text-2xl font-extrabold uppercase tracking-wider text-ink-strong sm:mt-1 sm:text-3xl"
            >
              {youWon ? 'You won' : 'Winner'}
            </h2>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:space-y-4 sm:px-5 sm:py-5">
            <div
              className={`rounded-xl border px-3 py-3 sm:px-4 sm:py-4 ${
                youWon
                  ? 'border-sidebar/25 bg-white shadow-[0_4px_16px_rgb(29_4_50_/_0.05)]'
                  : 'border-sidebar/10 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-display text-base font-bold text-ink-strong sm:text-lg">
                  {winnerName}
                  {youWon ? ' · you' : ''}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: hex }}
                >
                  {color}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-display font-semibold uppercase tracking-wider text-ink-strong-muted sm:mt-1.5 sm:text-sm">
                All four tokens home
              </p>
              <p className="mt-2 text-center text-xs text-ink-strong-muted">
                First to finish the board takes the match. Ready up for a rematch.
              </p>
            </div>
          </div>

          <div className="shrink-0 border-t border-sidebar/10 bg-white px-3 py-2.5 sm:px-5 sm:py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {canReady ? (
                <Button
                  type="button"
                  onClick={onReady}
                  size="sm"
                  className={cn(
                    'btn-segment',
                    isReady && 'ring-2 ring-sidebar/25 ring-offset-2 ring-offset-white',
                  )}
                >
                  {isReady ? 'Not ready' : 'Play rematch'}
                </Button>
              ) : (
                <p className="flex-1 text-center text-[10px] text-ink-strong-muted">Waiting…</p>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-md border border-sidebar/20 bg-white px-2.5 py-1.5 text-[11px] font-display font-semibold text-ink-strong hover:bg-sidebar/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {readyPlayers.length > 0 ? (
          <ReadyPlayersRoster
            players={readyPlayers}
            readyCount={readyCount}
            readyTotal={readyTotal}
            heading="Ready for rematch"
          />
        ) : null}
      </div>
    </div>
  );
}
