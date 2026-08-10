'use client';

import type { ReactNode } from 'react';
import { MoneyAmount } from './CurrencyIcon';
import { PlayerAvatar } from './PlayerAvatar';
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

export type ReadyRosterPlayer = {
  seat: number;
  name: string;
  userId?: string | null;
  avatarId?: number | null;
  ready: boolean;
  isSelf?: boolean;
  /** Seated but sitting out — shown with muted badge. */
  sittingOut?: boolean;
};

/** Avatar strip for cash-table ready state (first hand + between hands). */
export function ReadyPlayersRoster({
  players,
  readyCount,
  readyTotal,
  heading = 'Ready for next hand',
  className = '',
  /** Tighter strip for the floating Actions dock. */
  compact = false,
}: {
  players: ReadyRosterPlayer[];
  readyCount?: number;
  readyTotal?: number;
  heading?: string;
  className?: string;
  compact?: boolean;
}) {
  const narrow = useIsNarrow();
  if (players.length === 0) return null;

  const rCount = readyCount ?? players.filter((p) => p.ready).length;
  const rTotal = readyTotal ?? players.length;
  const rosterAvatarSize = compact
    ? 36
    : players.length > 5
      ? narrow
        ? 40
        : 44
      : narrow
        ? 48
        : 56;

  return (
    <section
      aria-label={heading}
      className={
        compact
          ? `mx-auto w-full max-w-sm rounded-lg border border-sidebar/10 bg-mushroom/40 px-2.5 py-2 ${className}`.trim()
          : `rounded-2xl border border-sidebar/12 bg-white/95 px-3 py-3 shadow-[0_12px_32px_rgb(29_4_50_/_0.12)] sm:px-4 sm:py-3.5 ${className}`.trim()
      }
    >
      <div
        className={`flex items-center justify-between gap-2 ${compact ? 'mb-1.5' : 'mb-2.5'}`}
      >
        <h3
          className={`font-display font-bold uppercase tracking-[0.16em] text-sidebar/70 ${
            compact ? 'text-[9px]' : 'text-[10px]'
          }`}
        >
          {heading}
        </h3>
        <p
          className={`font-display font-semibold tabular-nums tracking-wide text-sidebar/65 ${
            compact ? 'text-[9px]' : 'text-[10px]'
          }`}
          aria-label={`${rCount} of ${rTotal} ready`}
        >
          {rCount}/{rTotal}
        </p>
      </div>
      <ul
        className={
          compact
            ? 'flex flex-wrap items-end justify-center gap-x-3 gap-y-1.5'
            : 'flex flex-nowrap items-end justify-between gap-1 sm:gap-1.5'
        }
      >
        {players.map((p) => {
          const label = p.isSelf ? `${p.name} (you)` : p.name;
          return (
            <li
              key={p.seat}
              className={
                compact
                  ? 'flex w-[3.25rem] shrink-0 flex-col items-center gap-0.5'
                  : 'flex min-w-0 flex-1 flex-col items-center gap-0.5 sm:gap-1'
              }
            >
              <div
                className={`relative rounded-full p-[2px] transition ${
                  p.ready && !p.sittingOut
                    ? 'bg-gradient-to-b from-sidebar to-sidebar/80 shadow-[0_0_0_2px_rgb(29_4_50_/_0.12),0_4px_12px_rgb(29_4_50_/_0.14)]'
                    : 'bg-sidebar/10'
                }`}
              >
                <PlayerAvatar
                  userId={p.userId}
                  avatarId={p.avatarId}
                  size={rosterAvatarSize}
                  title={label}
                  className={`ring-2 ring-white ${
                    p.ready && !p.sittingOut ? '' : 'opacity-55 grayscale-[0.35]'
                  }`}
                />
                {p.ready && !p.sittingOut ? (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-white bg-sidebar text-mushroom shadow-sm ${
                      compact ? 'h-3.5 w-3.5' : 'h-4 w-4 sm:h-5 sm:w-5'
                    }`}
                    aria-hidden
                    title="Ready"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className={compact ? 'h-1.5 w-1.5' : 'h-2 w-2 sm:h-2.5 sm:w-2.5'}
                      fill="none"
                    >
                      <path
                        d="M2.5 6.2 5 8.7 9.5 3.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white ${
                      p.sittingOut ? 'bg-amber-200' : 'bg-stone-200'
                    } ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4 sm:h-5 sm:w-5'}`}
                    aria-hidden
                    title={p.sittingOut ? 'Sitting out' : 'Not ready'}
                  />
                )}
              </div>
              <span
                className={`w-full truncate text-center font-display font-semibold leading-tight ${
                  compact ? 'text-[9px]' : 'text-[9px] sm:text-[10px]'
                } ${
                  p.sittingOut
                    ? 'text-amber-800/80'
                    : p.ready
                      ? 'text-sidebar'
                      : 'text-sidebar/50'
                }`}
                title={label}
              >
                {p.isSelf ? 'You' : p.name}
                {p.sittingOut ? (
                  <span className="sr-only"> — sitting out</span>
                ) : p.ready ? (
                  <span className="sr-only"> — ready</span>
                ) : (
                  <span className="sr-only"> — not ready</span>
                )}
              </span>
              {p.sittingOut ? (
                <span className="text-[7px] font-bold uppercase tracking-wide text-amber-800/70">
                  Out
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function WinHandModal({
  winners,
  youWon,
  canStartNext,
  readyCount,
  readyTotal,
  isReady,
  readyPlayers,
  canTopUp,
  canSitOut,
  canSitIn,
  isTournament,
  needChips,
  onNextHand,
  onTopUp,
  onSitOut,
  onSitIn,
  onDismiss,
  onNeedChips,
}: {
  winners: WinLine[];
  youWon: boolean;
  canStartNext: boolean;
  readyCount?: number;
  readyTotal?: number;
  isReady?: boolean;
  /** Eligible players for next hand — shown below the sheet with avatar focus. */
  readyPlayers?: ReadyRosterPlayer[];
  canTopUp?: boolean;
  canSitOut?: boolean;
  canSitIn?: boolean;
  /** Contest table context (sit-out limits, layout). */
  isTournament?: boolean;
  /** Broke at a cash table with no bankroll top-up. */
  needChips?: boolean;
  onNextHand: () => void;
  onTopUp?: () => void;
  onSitOut?: () => void;
  onSitIn?: () => void;
  onDismiss: () => void;
  onNeedChips?: () => void;
}) {
  const roster = readyPlayers ?? [];

  let primary: ReactNode;
  if (canStartNext) {
    primary = (
      <button
        type="button"
        onClick={onNextHand}
        className={`btn-primary min-h-9 min-w-0 flex-1 px-3 py-2 text-xs font-display font-bold uppercase tracking-wide ${
          isReady ? 'ring-2 ring-sidebar/25 ring-offset-2 ring-offset-white' : ''
        }`}
      >
        {isReady ? 'Not ready' : 'Play Next Hand'}
      </button>
    );
  } else if (canSitIn && onSitIn) {
    primary = (
      <button
        type="button"
        onClick={onSitIn}
        className="btn-primary min-h-9 min-w-0 flex-1 px-3 py-2 text-xs font-display font-bold uppercase tracking-wide"
      >
        Sit in
      </button>
    );
  } else if (canTopUp && onTopUp) {
    primary = (
      <button
        type="button"
        onClick={onTopUp}
        className="btn-primary min-h-9 min-w-0 flex-1 px-3 py-2 text-xs font-display font-bold uppercase tracking-wide"
      >
        Top up
      </button>
    );
  } else if (needChips && onNeedChips) {
    primary = (
      <button
        type="button"
        onClick={onNeedChips}
        className="btn-primary min-h-9 min-w-0 flex-1 px-3 py-2 text-xs font-display font-bold uppercase tracking-wide"
      >
        Need chips
      </button>
    );
  } else {
    primary = (
      <p className="flex-1 text-center text-[10px] text-ink-strong-muted">Waiting…</p>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-overlay/55 p-3 backdrop-blur-[3px] sm:items-center sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-lg flex-col items-stretch gap-3 sm:gap-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="win-hand-title"
          className="flex max-h-[min(78dvh,36rem)] w-full flex-col overflow-hidden rounded-2xl border border-sidebar/12 bg-white shadow-[0_18px_48px_rgb(29_4_50_/_0.18)]"
        >
          <div className="shrink-0 border-b border-sidebar/10 bg-mushroom/40 px-4 py-3 text-center sm:px-5 sm:py-5">
            <p className="text-[9px] font-display uppercase tracking-[0.28em] text-sidebar/50 sm:text-[10px]">
              Hand complete
            </p>
            <h2
              id="win-hand-title"
              className="mt-0.5 font-display text-2xl font-extrabold uppercase tracking-wider text-sidebar sm:mt-1 sm:text-3xl"
            >
              {youWon ? 'You won' : 'Winner'}
            </h2>
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
                      ? 'border-sidebar/25 bg-mushroom/50 shadow-[0_4px_16px_rgb(29_4_50_/_0.05)]'
                      : 'border-sidebar/10 bg-mushroom/30'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-display text-base font-bold text-sidebar sm:text-lg">
                      {w.name}
                      {w.isSelf ? ' · you' : ''}
                    </span>
                    <MoneyAmount
                      amount={w.amount}
                      prefix="+"
                      compact
                      className="shrink-0 font-mono text-sm font-semibold text-brass-dim sm:text-base"
                    />
                  </div>

                  {type && (
                    <p className="mt-1 text-[11px] font-display font-semibold uppercase tracking-wider text-sidebar/70 sm:mt-1.5 sm:text-sm">
                      {type}
                    </p>
                  )}

                  {cards.length > 0 ? (
                    <div className="mt-2.5 flex w-full flex-nowrap gap-1 sm:mt-3 sm:gap-1.5">
                      {cards.map((code) => (
                        <PlayingCard
                          key={`${w.seat}-${code}`}
                          code={code}
                          highlight
                          size="board"
                          className="!h-auto min-w-0 !w-full flex-1 !scale-100 aspect-[2/3]"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-center text-xs text-ink-strong-muted">
                      Won without showdown
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-sidebar/10 bg-mushroom/25 px-3 py-2.5 sm:px-5 sm:py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Secondary actions — top-up is primary when it's the only path forward */}
              {canTopUp && onTopUp && canStartNext && (
                <button
                  type="button"
                  onClick={onTopUp}
                  className="rounded-md border border-brass-dim/40 bg-brass/15 px-2.5 py-1.5 text-[11px] font-display font-semibold text-brass-dim hover:bg-brass/25"
                >
                  Top up
                </button>
              )}
              {canSitOut && onSitOut && !isTournament && (
                <button
                  type="button"
                  onClick={onSitOut}
                  className="rounded-md border border-amber-600/35 bg-amber-50 px-2.5 py-1.5 text-[11px] font-display font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Sit out
                </button>
              )}
              {primary}
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-md border border-sidebar/20 bg-white px-2.5 py-1.5 text-[11px] font-display font-semibold text-sidebar/70 hover:bg-mushroom/60 hover:text-sidebar"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {!isTournament && roster.length > 0 ? (
          <ReadyPlayersRoster
            players={roster}
            readyCount={readyCount}
            readyTotal={readyTotal}
            heading="Ready for next hand"
          />
        ) : null}
      </div>
    </div>
  );
}
