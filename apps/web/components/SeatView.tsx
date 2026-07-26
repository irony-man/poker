'use client';

import { ChipStack, formatChips } from './ChipStack';
import { PlayingCard } from './PlayingCard';
import type { PublicPlayer } from '@/lib/store';

export function SeatView({
  player,
  isDealer,
  isToAct,
  isSelf,
  isWinner,
  winAmount,
  handName,
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
  isWinner?: boolean;
  winAmount?: number;
  handName?: string | null;
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
          className="rounded border border-dashed border-cyan/30 bg-ink-panel/70 px-2.5 py-1.5 text-[10px] font-display font-semibold uppercase tracking-wider text-cream/60 hover:border-gold hover:text-gold transition backdrop-blur-sm"
        >
          Sit
        </button>
        {canManageBots && (
          <button
            type="button"
            onClick={onAddBot}
            className="rounded border border-dashed border-cyan/30 bg-ink-panel/70 px-2.5 py-1.5 text-[10px] font-display font-semibold uppercase tracking-wider text-cream/60 hover:border-gold hover:text-gold transition backdrop-blur-sm"
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
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 ${isToAct || isWinner ? 'z-20' : 'z-10'}`}
    >
      <div className="flex gap-1 drop-shadow-md">
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

      {handName && (
        <div
          className={`rounded border px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wide ${
            isWinner
              ? 'border-gold bg-gold text-ink shadow-glow'
              : 'border-cyan/25 bg-ink-panel/90 text-cyan'
          }`}
        >
          {handName}
        </div>
      )}

      <div
        className={`relative min-w-[7.5rem] rounded-lg px-3 py-2 text-center backdrop-blur-sm transition ${
          isWinner
            ? 'bg-gold text-ink ring-2 ring-gold-light shadow-glow'
            : isToAct
              ? 'bg-gold text-ink ring-2 ring-gold-light animate-hud-pulse'
              : isSelf
                ? 'bg-ink-panel/95 text-cream border border-gold/35 shadow-hud'
                : 'bg-ink-panel/90 text-cream border border-cyan/15'
        }`}
      >
        {isDealer && (
          <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-gold/50 bg-ink text-[10px] font-display font-bold text-gold shadow-glow">
            D
          </span>
        )}
        {isBot && !isWinner && (
          <span className="absolute -right-2 -top-2 rounded border border-cyan/30 bg-ink px-1 text-[9px] font-display uppercase tracking-wide text-cyan">
            bot
          </span>
        )}
        <div className="text-sm font-display font-semibold truncate max-w-[8rem] tracking-wide">
          {player.name}
        </div>
        <div className="mt-1 flex justify-center text-inherit">
          <ChipStack amount={player.stack} size="sm" />
        </div>
        {player.bet > 0 && (
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center text-gold-light">
            <ChipStack amount={player.bet} size="sm" />
          </div>
        )}
        {player.status === 'folded' && (
          <div className="absolute inset-0 rounded-lg bg-black/65 flex items-center justify-center text-[10px] font-display uppercase tracking-wide text-cream/80">
            Fold
          </div>
        )}
        {player.status === 'allin' && (
          <div className="mt-0.5 text-[9px] font-display uppercase tracking-wider text-felt-neon">All-in</div>
        )}
      </div>
      {isWinner && winAmount != null && winAmount > 0 && (
        <div className="text-[11px] font-bold text-gold-light drop-shadow">+{formatChips(winAmount)}</div>
      )}
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
