'use client';

import { useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { MoneyAmount } from './CurrencyIcon';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayingCard } from './PlayingCard';
import { useModalFocus } from '@/lib/useModalFocus';
import { useIsNarrow } from '@/lib/tableLayout';
import { cn } from '@/lib/cn';

export type WinLine = {
  seat: number;
  name: string;
  /** Net chips this hand (pot share minus own contribution); negative when lost. */
  amount: number;
  handName?: string;
  /** Best five at showdown. */
  cards?: string[];
  /** Known hole cards (revealed at showdown, or your own). */
  holeCards?: string[] | null;
  isSelf?: boolean;
  isWinner?: boolean;
  userId?: string | null;
  avatarId?: number | null;
  avatarUrl?: string | null;
};

export type ReadyRosterPlayer = {
  seat: number;
  name: string;
  userId?: string | null;
  avatarId?: number | null;
  avatarUrl?: string | null;
  ready: boolean;
  isSelf?: boolean;
  /** Seated but sitting out — shown with muted badge. */
  sittingOut?: boolean;
};

/** Avatar strip for ready state (first hand + between hands). */
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
          ? `mx-auto w-full max-w-sm rounded-lg border border-sidebar/10 bg-page/40 px-2.5 py-2 ${className}`.trim()
          : `rounded-2xl border border-sidebar/12 bg-white/95 px-3 py-3 shadow-[0_12px_32px_rgb(29_4_50_/_0.12)] sm:px-4 sm:py-3.5 ${className}`.trim()
      }
    >
      <div
        className={`flex items-center justify-between gap-2 ${compact ? 'mb-1.5' : 'mb-2.5'}`}
      >
        <h3
          className={`font-display font-bold uppercase tracking-[0.16em] text-sidebar ${
            compact ? 'text-[11px]' : 'text-xs'
          }`}
        >
          {heading}
        </h3>
        <p
          className={`font-display font-semibold tabular-nums tracking-wide text-sidebar ${
            compact ? 'text-[11px]' : 'text-xs'
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
                  avatarUrl={p.avatarUrl}
                  size={rosterAvatarSize}
                  title={label}
                  className={`ring-2 ring-white ${
                    p.ready && !p.sittingOut ? '' : 'opacity-55 grayscale-[0.35]'
                  }`}
                />
                {p.ready && !p.sittingOut ? (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full border-2 border-white bg-sidebar text-on-chrome shadow-sm ${
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
                  compact ? 'text-[11px]' : 'text-[11px] sm:text-xs'
                } ${
                  p.sittingOut
                    ? 'text-amber-800'
                    : p.ready
                      ? 'text-sidebar'
                      : 'text-sidebar/80'
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
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-900">
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

function NetAmount({ amount }: { amount: number }) {
  const base = 'shrink-0 font-mono text-sm font-semibold sm:text-base';
  if (amount > 0) {
    return <MoneyAmount amount={amount} prefix="+" compact className={`${base} text-brass-dim`} />;
  }
  if (amount < 0) {
    return <MoneyAmount amount={-amount} prefix="−" compact className={`${base} text-danger`} />;
  }
  return <span className={`${base} text-muted`}>0</span>;
}

const RESULT_CARD = '!h-auto min-w-0 !w-full !scale-100 aspect-[2/3]';

/** One player's result: hole cards, best five at showdown, and net chips. */
function HandResultRow({ line }: { line: WinLine }) {
  const best = line.cards ?? [];
  const bestSet = new Set(best);
  const hole = line.holeCards?.length === 2 ? line.holeCards : null;
  const handType = line.handName && line.handName !== 'Uncontested' ? line.handName : null;
  const status = handType ?? (line.isWinner ? 'Won without showdown' : null);

  return (
    <li
      className={cn(
        'rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3',
        line.isWinner
          ? 'border-brass-dim/40 bg-brass/10 shadow-[0_4px_16px_rgb(29_4_50_/_0.06)]'
          : line.isSelf
            ? 'border-sidebar/25 bg-page/50'
            : 'border-sidebar/10 bg-page/30',
      )}
    >
      <div className="flex items-center gap-2.5">
        <PlayerAvatar
          userId={line.userId}
          avatarId={line.avatarId}
          avatarUrl={line.avatarUrl}
          size={32}
          title={line.name}
        />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-display text-sm font-bold text-sidebar sm:text-base">
              {line.name}
              {line.isSelf ? ' · you' : ''}
            </span>
            {line.isWinner ? (
              <span className="shrink-0 rounded-full bg-brass/25 px-1.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-brass-dim">
                Winner
              </span>
            ) : null}
          </p>
          {status ? (
            <p className="truncate font-display text-[11px] font-semibold uppercase tracking-wider text-sidebar/70">
              {status}
            </p>
          ) : null}
        </div>
        <span title={line.amount < 0 ? 'Chips lost this hand' : 'Chips won this hand'}>
          <NetAmount amount={line.amount} />
        </span>
      </div>

      <div className="mt-2 grid w-full grid-cols-[1fr_1fr_0.4fr_1fr_1fr_1fr_1fr_1fr] items-end gap-x-1 gap-y-1 sm:gap-x-1.5">
        <span className="col-span-2 text-[10px] font-display font-semibold uppercase tracking-wider text-muted">
          Hole
        </span>
        <span className="col-span-5 col-start-4 text-[10px] font-display font-semibold uppercase tracking-wider text-muted">
          {best.length > 0 ? 'Best hand' : ''}
        </span>
        {hole
          ? hole.map((code) => (
              <PlayingCard
                key={`hole-${code}`}
                code={code}
                size="board"
                highlight={line.isWinner && bestSet.has(code)}
                className={RESULT_CARD}
              />
            ))
          : [0, 1].map((i) => (
              <PlayingCard key={`back-${i}`} faceDown size="board" className={RESULT_CARD} />
            ))}
        {best.length > 0 ? (
          <>
            <span aria-hidden />
            {best.map((code) => (
              <PlayingCard
                key={`best-${code}`}
                code={code}
                size="board"
                highlight={line.isWinner}
                className={RESULT_CARD}
              />
            ))}
          </>
        ) : null}
      </div>
    </li>
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
  whuffiesEarned = null,
  whuffiesTeaser,
  whuffieSignInHint = false,
  offlineGameComplete = false,
  nextHandLabel,
}: {
  winners: WinLine[];
  youWon: boolean;
  /** Whuffies credited this hand (signed-in offline win). */
  whuffiesEarned?: number | null;
  /** Configured Whuffies for guests (teaser before sign-in). */
  whuffiesTeaser?: number;
  whuffieSignInHint?: boolean;
  /** Offline session won (all bots busted); Whuffies apply here, not per hand. */
  offlineGameComplete?: boolean;
  /** Overrides default “Play Next Hand” (e.g. offline game won). */
  nextHandLabel?: string;
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalFocus({
    open: true,
    containerRef: dialogRef,
    initialFocusRef: closeRef,
    onClose: onDismiss,
  });

  const whuffieAmount =
    whuffiesEarned != null && whuffiesEarned > 0
      ? whuffiesEarned
      : whuffiesTeaser != null && whuffiesTeaser > 0
        ? whuffiesTeaser
        : null;

  let primary: ReactNode;
  if (canStartNext) {
    primary = (
      <Button
        type="button"
        onClick={onNextHand}
        size="sm"
        className={cn('btn-segment', isReady && 'ring-2 ring-sidebar/25 ring-offset-2 ring-offset-white')}
      >
        {isReady ? 'Not ready' : (nextHandLabel ?? 'Play Next Hand')}
      </Button>
    );
  } else if (canSitIn && onSitIn) {
    primary = (
      <Button
        type="button"
        onClick={onSitIn}
        size="sm"
        className="btn-segment"
      >
        Sit in
      </Button>
    );
  } else if (canTopUp && onTopUp) {
    primary = (
      <Button
        type="button"
        onClick={onTopUp}
        size="sm"
        className="btn-segment"
      >
        Top up
      </Button>
    );
  } else if (needChips && onNeedChips) {
    primary = (
      <Button
        type="button"
        onClick={onNeedChips}
        size="sm"
        className="btn-segment"
      >
        Need chips
      </Button>
    );
  } else {
    primary = (
      <p className="flex-1 text-center text-xs text-muted">Waiting…</p>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-overlay/55 p-3 backdrop-blur-[3px] sm:items-center sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-lg flex-col items-stretch gap-3 sm:gap-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="win-hand-title"
          tabIndex={-1}
          className="surface-modal flex max-h-[min(78dvh,36rem)] w-full flex-col"
        >
          <div className="shrink-0 border-b border-sidebar/10 bg-page/40 px-4 py-3 text-center sm:px-5 sm:py-5">
            <p className="text-[11px] font-display uppercase tracking-[0.28em] text-sidebar sm:text-xs">
              {offlineGameComplete && youWon ? 'Game complete' : 'Hand complete'}
            </p>
            <h2
              id="win-hand-title"
              className="mt-0.5 font-display text-2xl font-extrabold uppercase tracking-wider text-sidebar sm:mt-1 sm:text-3xl"
            >
              {offlineGameComplete && youWon
                ? 'You won the game'
                : youWon
                  ? 'You won'
                  : 'Winner'}
            </h2>
            {offlineGameComplete && youWon && whuffieAmount != null ? (
              <div className="mt-2 flex flex-col items-center gap-1">
                <MoneyAmount
                  amount={whuffieAmount}
                  prefix="+"
                  showWhuffies
                  compact
                  className="font-mono text-base font-semibold text-brass-dim sm:text-lg"
                />
                {whuffieSignInHint ? (
                  <p className="text-[11px] text-muted sm:text-xs">Sign in to claim Whuffies</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 sm:space-y-4 sm:px-5 sm:py-5">
            <ul className="space-y-2 sm:space-y-2.5" aria-label="Hand results">
              {winners.map((w) => (
                <HandResultRow key={w.seat} line={w} />
              ))}
            </ul>
          </div>

          <div className="shrink-0 border-t border-sidebar/10 bg-page/25 px-3 py-2.5 sm:px-5 sm:py-3">
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
                ref={closeRef}
                type="button"
                onClick={onDismiss}
                className="rounded-md border border-sidebar/20 bg-white px-2.5 py-1.5 text-[11px] font-display font-semibold text-sidebar hover:bg-page/60"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {roster.length > 0 && !offlineGameComplete ? (
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
