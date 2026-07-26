'use client';

import { ChipStack, formatChips } from './ChipStack';
import { PlayingCard } from './PlayingCard';
import { PlayerAvatar } from './PlayerAvatar';
import { SeatTurnRing } from './TurnTimer';
import type { PublicPlayer } from '@/lib/store';

export function SeatView({
  player,
  isDealer,
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
  isDealer: boolean;
  isToAct: boolean;
  isSelf: boolean;
  isWinner?: boolean;
  winAmount?: number;
  handName?: string | null;
  /** Remount hole cards when a new hand deals. */
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
  const x = 50 + Math.cos(rad) * 40;
  const y = 50 + Math.sin(rad) * 36;
  const isBot = !!player.userId?.startsWith('bot:');

  // Bet sits slightly toward table center from the seat
  const betX = 50 + Math.cos(rad) * 24;
  const betY = 50 + Math.sin(rad) * 20;

  if (player.status === 'empty') {
    if (spectating) {
      return (
        <div
          style={{ left: `${x}%`, top: `${y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-cream/20 bg-ink/40 px-3 py-1.5 text-[11px] font-display uppercase tracking-wider text-cream/40 backdrop-blur-sm"
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
          className="rounded-full border border-dashed border-cream/35 bg-ink/55 px-3 py-1.5 text-[11px] font-display font-semibold uppercase tracking-wider text-cream/70 hover:border-gold hover:text-gold transition backdrop-blur-sm"
        >
          Sit
        </button>
        {canManageBots && (
          <button
            type="button"
            onClick={onAddBot}
            className="rounded-full border border-dashed border-cream/35 bg-ink/55 px-3 py-1.5 text-[11px] font-display font-semibold uppercase tracking-wider text-cream/70 hover:border-gold hover:text-gold transition backdrop-blur-sm"
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
  const avatarSize = isSelf ? 52 : 44;
  const ringBox = avatarSize + 12;

  return (
    <>
      {player.bet > 0 && (
        <div
          style={{ left: `${betX}%`, top: `${betY}%` }}
          className="absolute z-[12] -translate-x-1/2 -translate-y-1/2"
        >
          <div className="rounded-full border border-gold/30 bg-ink/70 px-2 py-1 shadow-lg backdrop-blur-sm">
            <ChipStack amount={player.bet} size="sm" compact />
          </div>
        </div>
      )}

      <div
        style={{ left: `${x}%`, top: `${y}%` }}
        className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 ${isToAct || isWinner ? 'z-20' : 'z-10'}`}
      >
        <div className={`flex drop-shadow-lg ${isSelf ? 'gap-1.5 -mt-1 mb-1 scale-110 origin-bottom' : 'gap-1'}`}>
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
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-display font-bold tracking-wide ${
              isWinner
                ? 'bg-gold text-ink shadow-glow'
                : 'border border-cream/20 bg-ink/80 text-cream/85'
            }`}
          >
            {handName}
          </div>
        )}

        <div
          className={`relative flex items-center justify-center ${
            isToAct ? 'animate-hud-pulse' : ''
          }`}
          style={{ width: ringBox, height: ringBox }}
        >
          <SeatTurnRing
            endsAt={turnEndsAt}
            totalMs={turnTotalMs ?? 20000}
            active={!!isToAct}
            size={ringBox}
          />
          <PlayerAvatar
            avatarId={player.avatarId}
            userId={player.userId}
            size={avatarSize}
            className={
              isWinner
                ? 'ring-2 ring-gold shadow-glow'
                : isSelf
                  ? 'ring-2 ring-gold/55'
                  : ''
            }
          />
          {isDealer && (
            <span className="absolute -left-0.5 -top-0.5 z-[1] flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-b from-cream to-[#c4b89a] text-[10px] font-display font-bold text-ink shadow-md ring-1 ring-black/20">
              D
            </span>
          )}
          {isBot && !isWinner && (
            <span className="absolute -right-0.5 -bottom-0.5 z-[1] rounded bg-cyan/25 px-1 text-[7px] font-display uppercase tracking-wide text-cyan">
              bot
            </span>
          )}
          {player.status === 'folded' && (
            <div className="absolute inset-[6px] rounded-full bg-black/70 flex items-center justify-center text-[9px] font-display uppercase tracking-widest text-cream/80">
              Fold
            </div>
          )}
        </div>

        <div
          className={`min-w-[5.5rem] rounded-xl px-2.5 py-1 text-center shadow-md ${
            isWinner
              ? 'bg-gold text-ink'
              : isToAct
                ? 'bg-gold/90 text-ink'
                : isSelf
                  ? 'bg-ink/85 text-cream border border-gold/40'
                  : 'bg-ink/80 text-cream border border-white/10'
          }`}
        >
          <div className="text-[12px] font-display font-semibold truncate max-w-[7rem] tracking-wide leading-tight">
            {player.name}
            {isSelf ? ' · you' : ''}
          </div>
          <div className="mt-0.5 flex justify-center">
            <ChipStack amount={player.stack} size="sm" compact />
          </div>
          {player.status === 'allin' && (
            <div className="text-[8px] font-display uppercase tracking-[0.16em] text-felt-neon">
              All-in
            </div>
          )}
        </div>

        {isWinner && winAmount != null && winAmount > 0 && (
          <div className="text-[12px] font-display font-bold text-gold-light drop-shadow">
            +{formatChips(winAmount)}
          </div>
        )}
        {isBot && canManageBots && onRemoveBot && (
          <button
            type="button"
            onClick={onRemoveBot}
            className="text-[10px] text-cream/40 hover:text-red-300"
          >
            Remove
          </button>
        )}
      </div>
    </>
  );
}
