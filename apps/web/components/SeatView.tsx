'use client';

import { ChipStack, formatChips } from './ChipStack';
import { PlayingCard, type CardSize } from './PlayingCard';
import { PlayerAvatar } from './PlayerAvatar';
import { SeatTurnRing } from './TurnTimer';
import type { PublicPlayer } from '@/lib/store';

function money(n: number): string {
  return `$${formatChips(n)}`;
}

export function SeatView({
  player,
  isToAct,
  isSelf,
  isWinner,
  winAmount,
  handName,
  handId,
  myCards,
  winningCards,
  turnEndsAt,
  turnTotalMs,
  onSit,
  onAddBot,
  onRemoveBot,
  canManageBots,
  spectating,
  angle,
  compact = false,
}: {
  player: PublicPlayer;
  isToAct: boolean;
  isSelf: boolean;
  isWinner?: boolean;
  winAmount?: number;
  handName?: string | null;
  handId?: string | null;
  myCards: [string, string] | null;
  winningCards?: Set<string> | null;
  turnEndsAt?: number | null;
  turnTotalMs?: number;
  onSit?: () => void;
  onAddBot?: () => void;
  onRemoveBot?: () => void;
  canManageBots?: boolean;
  spectating?: boolean;
  angle: number;
  /** Portrait / narrow: push seats to rim, shrink cards & chrome. */
  compact?: boolean;
}) {
  const rad = (angle * Math.PI) / 180;
  const rx = compact ? 46 : 41;
  const ry = compact ? 43 : 37;
  const x = 50 + Math.cos(rad) * rx;
  const y = 50 + Math.sin(rad) * ry;
  const isBot = !!player.userId?.startsWith('bot:');

  const betX = 50 + Math.cos(rad) * (compact ? 26 : 23);
  const betY = 50 + Math.sin(rad) * (compact ? 22 : 19);

  if (player.status === 'empty') {
    if (spectating) {
      return (
        <div
          style={{ left: `${x}%`, top: `${y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-white/25 bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/45"
        >
          Empty
        </div>
      );
    }
    return (
      <div
        style={{ left: `${x}%`, top: `${y}%` }}
        className="absolute -translate-x-1/2 -translate-y-1/2 flex gap-1"
      >
        <button
          type="button"
          onClick={onSit}
          className="rounded-md border border-dashed border-white/40 bg-black/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80 hover:border-white hover:text-white"
        >
          Sit
        </button>
        {canManageBots && (
          <button
            type="button"
            onClick={onAddBot}
            className="rounded-md border border-dashed border-white/40 bg-black/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80 hover:border-white hover:text-white"
          >
            Bot
          </button>
        )}
      </div>
    );
  }

  const showCards = isSelf && myCards ? myCards : player.holeCards;
  /** On mobile, only the hero shows hole cards — opponents are avatar + stack. */
  const renderCards = !compact || isSelf;
  const faceDown = renderCards && !showCards && player.hasCards;
  const dealKey = handId ?? 'idle';
  const folded = player.status === 'folded';
  const sittingOut = player.status === 'sittingOut';
  const cardSize: CardSize = compact ? 'sm' : isSelf ? 'md' : 'sm';
  const avatarSize = compact ? (isSelf ? 28 : 26) : isSelf ? 28 : 24;

  return (
    <>
      {player.bet > 0 && (
        <div
          style={{ left: `${betX}%`, top: `${betY}%` }}
          className="absolute z-[12] -translate-x-1/2 -translate-y-1/2"
        >
          <ChipStack amount={player.bet} size="sm" compact />
        </div>
      )}

      <div
        style={{ left: `${x}%`, top: `${y}%` }}
        className={`absolute -translate-x-1/2 -translate-y-1/2 ${isToAct || isWinner ? 'z-20' : 'z-10'} ${folded || sittingOut ? 'opacity-55' : ''}`}
      >
        <div
          className={`relative flex flex-col items-center ${
            compact ? 'px-0.5 pb-0.5 pt-0' : 'px-2.5 pb-2 pt-1.5'
          }`}
        >
          {renderCards && (faceDown || showCards) && (
            <div
              className={`relative z-[1] mb-0.5 flex drop-shadow-md gap-0.5 ${
                isSelf && !compact ? 'scale-110 origin-bottom' : ''
              }`}
            >
              {faceDown ? (
                <>
                  <PlayingCard key={`${dealKey}-${player.seat}-back-0`} faceDown size={cardSize} dealDelay={0} />
                  <PlayingCard key={`${dealKey}-${player.seat}-back-1`} faceDown size={cardSize} dealDelay={0.08} />
                </>
              ) : showCards ? (
                <>
                  <PlayingCard
                    key={`${dealKey}-${player.seat}-${showCards[0]}`}
                    code={showCards[0]}
                    size={cardSize}
                    dealDelay={0}
                    highlight={!!winningCards?.has(showCards[0]!)}
                    dimmed={!!winningCards && !winningCards.has(showCards[0]!)}
                  />
                  <PlayingCard
                    key={`${dealKey}-${player.seat}-${showCards[1]}`}
                    code={showCards[1]}
                    size={cardSize}
                    dealDelay={0.08}
                    highlight={!!winningCards?.has(showCards[1]!)}
                    dimmed={!!winningCards && !winningCards.has(showCards[1]!)}
                  />
                </>
              ) : null}
            </div>
          )}

          {handName && !compact && (
            <div
              className={`relative z-[1] mb-0.5 rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wide ${
                isWinner ? 'bg-[#e0b43a] text-black' : 'bg-black/70 text-white/90'
              }`}
            >
              {handName}
            </div>
          )}

          <div className="relative z-[1] flex items-end gap-0.5">
            <div className="relative mb-0.5 shrink-0">
              {isToAct && (
                <div className="pointer-events-none absolute -inset-1">
                  <SeatTurnRing
                    endsAt={turnEndsAt}
                    totalMs={turnTotalMs ?? 20000}
                    active
                    size={compact ? (isSelf ? 34 : 32) : isSelf ? 36 : 32}
                  />
                </div>
              )}
              <PlayerAvatar
                avatarId={player.avatarId}
                userId={player.userId}
                size={avatarSize}
                className="relative z-[1] shadow-md ring-1 ring-black/30"
              />
            </div>
            <div className="flex items-stretch shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
              <div className="flex flex-col justify-end">
                {isSelf && (
                  <span className="rounded-t-sm bg-[#f5c518] px-1 py-[1px] text-center text-[7px] font-extrabold uppercase leading-tight tracking-wide text-black">
                    You
                  </span>
                )}
                <span
                  className={`truncate px-1 py-0.5 text-[9px] font-bold leading-none sm:px-1.5 sm:py-1 sm:text-[10px] ${
                    compact ? 'max-w-[3.4rem]' : 'max-w-[3.2rem] sm:max-w-[3.6rem]'
                  } ${
                    isSelf
                      ? 'rounded-b-sm bg-white text-black'
                      : 'rounded-sm bg-white text-black'
                  }`}
                >
                  {(player.name ?? 'Seat').slice(0, compact ? 8 : 10)}
                </span>
              </div>
              <div
                className={`flex items-center justify-center font-extrabold tabular-nums tracking-tight text-white ${
                  compact
                    ? 'min-w-[3.1rem] px-1.5 py-1 text-[12px]'
                    : 'min-w-[2.75rem] px-1.5 py-1 text-[11px] sm:min-w-[3.75rem] sm:px-2.5 sm:py-1.5 sm:text-[13px]'
                } ${isWinner ? 'bg-[#c9a227]' : 'bg-[#c62828]'}`}
              >
                {money(player.stack)}
              </div>
            </div>
          </div>

          {handName && compact && (
            <div
              className={`relative z-[1] mt-0.5 max-w-[5.5rem] truncate rounded px-1 py-px text-[7px] font-bold tracking-wide ${
                isWinner ? 'bg-[#e0b43a] text-black' : 'bg-black/70 text-white/90'
              }`}
            >
              {handName}
            </div>
          )}

          {player.status === 'allin' && (
            <div className="relative z-[1] mt-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-[#2aff9a]">
              All-in
            </div>
          )}
          {folded && (
            <div className="relative z-[1] mt-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-white/70">
              Fold
            </div>
          )}
          {sittingOut && (
            <div className="relative z-[1] mt-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-amber-300/90">
              Sitting out
            </div>
          )}
        </div>

        {isWinner && winAmount != null && winAmount > 0 && (
          <div className="mt-0.5 text-center text-[11px] font-extrabold text-[#ffe29a] drop-shadow">
            +{money(winAmount)}
          </div>
        )}
        {isBot && canManageBots && onRemoveBot && !compact && (
          <button
            type="button"
            onClick={onRemoveBot}
            className="mt-0.5 text-[10px] text-white/40 hover:text-red-300"
          >
            Remove
          </button>
        )}
        {isBot && canManageBots && onRemoveBot && compact && (
          <button
            type="button"
            onClick={onRemoveBot}
            aria-label="Remove bot"
            className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/50 text-[9px] text-white/50 hover:text-red-300"
          >
            ×
          </button>
        )}
      </div>
    </>
  );
}
