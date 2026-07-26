'use client';

import { ChipStack, formatChips } from './ChipStack';
import { PlayingCard } from './PlayingCard';
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
              <PlayingCard faceDown small={!isSelf} />
              <PlayingCard faceDown small={!isSelf} />
            </>
          ) : showCards ? (
            <>
              <PlayingCard
                code={showCards[0]}
                small={!isSelf}
                highlight={!!winningCards?.has(showCards[0]!)}
                dimmed={!!winningCards && !winningCards.has(showCards[0]!)}
              />
              <PlayingCard
                code={showCards[1]}
                small={!isSelf}
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
          className={`relative min-w-[6.75rem] rounded-2xl px-3 py-2 text-center shadow-lg transition ${
            isWinner
              ? 'bg-gold text-ink ring-2 ring-gold-light shadow-glow'
              : isToAct
                ? 'bg-gold text-ink ring-2 ring-gold-light animate-hud-pulse'
                : isSelf
                  ? 'bg-gradient-to-b from-[#1a2210] to-[#0c1008] text-cream border border-gold/50'
                  : 'bg-gradient-to-b from-[#151b22] to-[#0a0e12] text-cream border border-white/10'
          }`}
        >
          <SeatTurnRing
            endsAt={turnEndsAt}
            totalMs={turnTotalMs ?? 20000}
            active={!!isToAct}
          />
          {isDealer && (
            <span className="absolute -left-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-cream to-[#c4b89a] text-[11px] font-display font-bold text-ink shadow-md ring-1 ring-black/20">
              D
            </span>
          )}
          {isBot && !isWinner && !isToAct && (
            <span className="absolute -right-1.5 -top-1.5 rounded bg-cyan/20 px-1 text-[8px] font-display uppercase tracking-wide text-cyan">
              bot
            </span>
          )}
          <div className="text-[13px] font-display font-semibold truncate max-w-[7.5rem] tracking-wide leading-tight">
            {player.name}
            {isSelf ? ' · you' : ''}
          </div>
          <div className="mt-1.5 flex justify-center">
            <ChipStack amount={player.stack} size="sm" compact />
          </div>
          {player.status === 'folded' && (
            <div className="absolute inset-0 rounded-2xl bg-black/70 flex items-center justify-center text-[10px] font-display uppercase tracking-widest text-cream/75">
              Fold
            </div>
          )}
          {player.status === 'allin' && (
            <div className="mt-1 text-[9px] font-display uppercase tracking-[0.18em] text-felt-neon">
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
