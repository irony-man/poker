'use client';

import { PlayingCard } from './PlayingCard';
import type { PublicPlayer } from '@/lib/store';

export function SeatView({
  player,
  isDealer,
  isToAct,
  isSelf,
  myCards,
  onSit,
  onAddBot,
  onRemoveBot,
  canManageBots,
  angle,
}: {
  player: PublicPlayer;
  isDealer: boolean;
  isToAct: boolean;
  isSelf: boolean;
  myCards: [string, string] | null;
  onSit?: () => void;
  onAddBot?: () => void;
  onRemoveBot?: () => void;
  canManageBots?: boolean;
  angle: number;
}) {
  const rad = (angle * Math.PI) / 180;
  const x = 50 + Math.cos(rad) * 38;
  const y = 50 + Math.sin(rad) * 34;
  const isBot = !!player.userId?.startsWith('bot:');

  if (player.status === 'empty') {
    return (
      <div
        style={{ left: `${x}%`, top: `${y}%` }}
        className="absolute -translate-x-1/2 -translate-y-1/2 flex gap-1"
      >
        <button
          type="button"
          onClick={onSit}
          className="rounded-full border border-dashed border-cream/30 px-2.5 py-1.5 text-[11px] text-cream/60 hover:border-gold hover:text-gold transition"
        >
          Sit
        </button>
        {canManageBots && (
          <button
            type="button"
            onClick={onAddBot}
            className="rounded-full border border-dashed border-cream/30 px-2.5 py-1.5 text-[11px] text-cream/60 hover:border-gold hover:text-gold transition"
          >
            Bot
          </button>
        )}
      </div>
    );
  }

  const showCards = isSelf && myCards ? myCards : player.holeCards;
  const faceDown = !showCards && player.hasCards;

  return (
    <div
      style={{ left: `${x}%`, top: `${y}%` }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 ${isToAct ? 'z-20' : 'z-10'}`}
    >
      <div className="flex gap-1">
        {faceDown ? (
          <>
            <PlayingCard faceDown small />
            <PlayingCard faceDown small />
          </>
        ) : showCards ? (
          <>
            <PlayingCard code={showCards[0]} small />
            <PlayingCard code={showCards[1]} small />
          </>
        ) : null}
      </div>
      <div
        className={`relative min-w-[7rem] rounded-lg px-3 py-1.5 text-center ${
          isToAct
            ? 'bg-gold text-ink ring-2 ring-gold-light animate-pulse'
            : 'bg-ink/80 text-cream border border-cream/15'
        }`}
      >
        {isDealer && (
          <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-cream text-[10px] font-bold text-ink">
            D
          </span>
        )}
        {isBot && (
          <span className="absolute -right-2 -top-2 rounded bg-cream/20 px-1 text-[9px] uppercase tracking-wide text-cream/80">
            bot
          </span>
        )}
        <div className="text-sm font-semibold truncate max-w-[8rem]">{player.name}</div>
        <div className="text-xs opacity-80">{player.stack}</div>
        {player.bet > 0 && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-gold-light whitespace-nowrap">
            bet {player.bet}
          </div>
        )}
        {player.status === 'folded' && (
          <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center text-[10px] uppercase tracking-wide">
            Fold
          </div>
        )}
      </div>
      {isBot && canManageBots && onRemoveBot && (
        <button
          type="button"
          onClick={onRemoveBot}
          className="text-[10px] text-cream/45 hover:text-red-300"
        >
          Remove
        </button>
      )}
    </div>
  );
}
