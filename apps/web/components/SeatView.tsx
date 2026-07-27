'use client';

import { ChipStack, formatChips } from './ChipStack';
import { PlayingCard } from './PlayingCard';
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
}) {
  const rad = (angle * Math.PI) / 180;
  const x = 50 + Math.cos(rad) * 41;
  const y = 50 + Math.sin(rad) * 37;
  const isBot = !!player.userId?.startsWith('bot:');

  const betX = 50 + Math.cos(rad) * 23;
  const betY = 50 + Math.sin(rad) * 19;

  if (player.status === 'empty') {
    if (spectating) {
      return (
        <div
          style={{ left: `${x}%`, top: `${y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-white/25 bg-black/25 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45"
        >
          Empty
        </div>
      );
    }
    return (
      <div
        style={{ left: `${x}%`, top: `${y}%` }}
        className="absolute -translate-x-1/2 -translate-y-1/2 flex gap-1.5"
      >
        <button
          type="button"
          onClick={onSit}
          className="rounded-md border border-dashed border-white/40 bg-black/35 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/80 hover:border-white hover:text-white"
        >
          Sit
        </button>
        {canManageBots && (
          <button
            type="button"
            onClick={onAddBot}
            className="rounded-md border border-dashed border-white/40 bg-black/35 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/80 hover:border-white hover:text-white"
          >
            Bot
          </button>
        )}
      </div>
    );
  }

  const showCards = isSelf && myCards ? myCards : player.holeCards;
  const faceDown = !showCards && player.hasCards;
  const dealKey = handId ?? 'idle';
  const folded = player.status === 'folded';

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
        className={`absolute -translate-x-1/2 -translate-y-1/2 ${isToAct || isWinner ? 'z-20' : 'z-10'} ${folded ? 'opacity-55' : ''}`}
      >
        <div
          className={`relative flex flex-col items-center px-2.5 pb-2 pt-1.5 ${
            isToAct ? 'rounded-[42%] border-2 border-dashed border-white/75' : ''
          }`}
        >
          {isToAct && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[118px] w-[118px] -translate-x-1/2 -translate-y-1/2">
              <SeatTurnRing
                endsAt={turnEndsAt}
                totalMs={turnTotalMs ?? 20000}
                active
                size={118}
              />
            </div>
          )}

          <div
            className={`relative z-[1] mb-1 flex drop-shadow-md ${
              isSelf ? 'scale-110 gap-1 origin-bottom' : 'gap-0.5'
            }`}
          >
            {faceDown ? (
              <>
                <PlayingCard key={`${dealKey}-${player.seat}-back-0`} faceDown small={!isSelf} dealDelay={0} />
                <PlayingCard key={`${dealKey}-${player.seat}-back-1`} faceDown small={!isSelf} dealDelay={0.08} />
              </>
            ) : showCards ? (
              <>
                <PlayingCard
                  key={`${dealKey}-${player.seat}-${showCards[0]}`}
                  code={showCards[0]}
                  small={!isSelf}
                  dealDelay={0}
                  highlight={!!winningCards?.has(showCards[0]!)}
                  dimmed={!!winningCards && !winningCards.has(showCards[0]!)}
                />
                <PlayingCard
                  key={`${dealKey}-${player.seat}-${showCards[1]}`}
                  code={showCards[1]}
                  small={!isSelf}
                  dealDelay={0.08}
                  highlight={!!winningCards?.has(showCards[1]!)}
                  dimmed={!!winningCards && !winningCards.has(showCards[1]!)}
                />
              </>
            ) : null}
          </div>

          {handName && (
            <div
              className={`relative z-[1] mb-1 rounded px-2 py-0.5 text-[9px] font-bold tracking-wide ${
                isWinner ? 'bg-[#e0b43a] text-black' : 'bg-black/70 text-white/90'
              }`}
            >
              {handName}
            </div>
          )}

          {/* Classic freepoker-style stack banner + name tab */}
          <div className="relative z-[1] flex items-end gap-1">
            <PlayerAvatar
              avatarId={player.avatarId}
              userId={player.userId}
              size={isSelf ? 28 : 24}
              className="mb-0.5 shadow-md ring-1 ring-black/30"
            />
            <div className="flex items-stretch shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
              <div className="flex flex-col justify-end">
                {isSelf && (
                  <span className="rounded-t-sm bg-[#f5c518] px-1.5 py-[1px] text-center text-[8px] font-extrabold uppercase leading-tight tracking-wide text-black">
                    You
                  </span>
                )}
                <span
                  className={`max-w-[3.6rem] truncate px-1.5 py-1 text-[10px] font-bold leading-none ${
                    isSelf
                      ? 'rounded-b-sm bg-white text-black'
                      : 'rounded-sm bg-white text-black'
                  }`}
                >
                  {(player.name ?? 'Seat').slice(0, 10)}
                </span>
              </div>
              <div
                className={`flex min-w-[3.75rem] items-center justify-center px-2.5 py-1.5 text-[13px] font-extrabold tabular-nums tracking-tight text-white ${
                  isWinner ? 'bg-[#c9a227]' : 'bg-[#c62828]'
                }`}
              >
                {money(player.stack)}
              </div>
            </div>

          </div>

          {player.status === 'allin' && (
            <div className="relative z-[1] mt-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-[#2aff9a]">
              All-in
            </div>
          )}
          {folded && (
            <div className="relative z-[1] mt-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-white/70">
              Fold
            </div>
          )}
        </div>

        {isWinner && winAmount != null && winAmount > 0 && (
          <div className="mt-0.5 text-center text-[12px] font-extrabold text-[#ffe29a] drop-shadow">
            +{money(winAmount)}
          </div>
        )}
        {isBot && canManageBots && onRemoveBot && (
          <button
            type="button"
            onClick={onRemoveBot}
            className="mt-0.5 text-[10px] text-white/40 hover:text-red-300"
          >
            Remove
          </button>
        )}
      </div>
    </>
  );
}
