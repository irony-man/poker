'use client';

import { ChipStack, formatChips } from './ChipStack';
import { HoleCardFan, PlayingCard, type CardSize } from './PlayingCard';
import { PlayerAvatar } from './PlayerAvatar';
import { SeatTurnRing } from './TurnTimer';
import { useSession, type PublicPlayer } from '@/lib/store';

function money(n: number): string {
  return `$${formatChips(n)}`;
}

function SeatActionPopup({ label, burstKey }: { label: string; burstKey: number }) {
  return (
    <div
      key={burstKey}
      className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-[115%]"
    >
      <span className="seat-action-popup inline-block whitespace-nowrap rounded-lg border-2 border-gold/60 bg-ink/95 px-3.5 py-1.5 text-sm font-extrabold uppercase tracking-wide text-gold shadow-[0_6px_18px_rgba(0,0,0,0.6)]">
        {label}
      </span>
    </div>
  );
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
  landscape = false,
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
  /** Rotated phone — reference-style stacked cards → stack → name. */
  landscape?: boolean;
}) {
  const rad = (angle * Math.PI) / 180;
  const rx = landscape ? 40 : compact ? 42 : 41;
  const ry = landscape ? 36 : compact ? 40 : 37;
  const x = 50 + Math.cos(rad) * rx;
  const y = 50 + Math.sin(rad) * ry;
  const isBot = !!player.userId?.startsWith('bot:');
  const actionBurst = useSession((s) => s.actionBurst);
  const showAction = actionBurst != null && actionBurst.seat === player.seat;

  const betX = 50 + Math.cos(rad) * (landscape ? 22 : compact ? 24 : 23);
  const betY = 50 + Math.sin(rad) * (landscape ? 18 : compact ? 20 : 19);

  if (player.status === 'empty') {
    if (spectating) {
      return (
        <div
          style={{ left: `${x}%`, top: `${y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-white/25 bg-black/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/45"
        >
          Empty
        </div>
      );
    }
    return (
      <div
        style={{ left: `${x}%`, top: `${y}%` }}
        className={`absolute -translate-x-1/2 -translate-y-1/2 flex gap-0.5 ${compact ? 'scale-90' : ''}`}
      >
        <button
          type="button"
          onClick={onSit}
          className={`rounded border border-dashed border-white/40 bg-black/35 font-bold uppercase tracking-wide text-white/80 hover:border-white hover:text-white ${
            compact ? 'px-1.5 py-0.5 text-[8px]' : 'rounded-md px-2.5 py-1 text-[10px]'
          }`}
        >
          Sit
        </button>
        {canManageBots && (
          <button
            type="button"
            onClick={onAddBot}
            className={`rounded border border-dashed border-white/40 bg-black/35 font-bold uppercase tracking-wide text-white/80 hover:border-white hover:text-white ${
              compact ? 'px-1.5 py-0.5 text-[8px]' : 'rounded-md px-2.5 py-1 text-[10px]'
            }`}
          >
            Bot
          </button>
        )}
      </div>
    );
  }

  const showCards = isSelf && myCards ? myCards : player.holeCards;
  /** Landscape shows opponent backs; portrait shows opponent backs so folds stay readable. */
  const renderCards = true;
  const faceDown = renderCards && !showCards && player.hasCards;
  const dealKey = handId ?? 'idle';
  const folded = player.status === 'folded';
  const sittingOut = player.status === 'sittingOut';
  const cardSize: CardSize = landscape ? 'peek' : compact ? 'sm' : isSelf ? 'md' : 'sm';
  const avatarSize = compact ? (isSelf ? 30 : 26) : isSelf ? 28 : 24;
  const displayName = isSelf ? 'You' : (player.name ?? 'Seat').slice(0, landscape ? 8 : compact ? 7 : 10);

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
        className={`absolute -translate-x-1/2 -translate-y-1/2 ${isToAct || isWinner || showAction ? 'z-20' : 'z-10'}`}
      >
        {showAction && actionBurst && (
          <SeatActionPopup label={actionBurst.label} burstKey={actionBurst.at} />
        )}
        <div className={folded || sittingOut ? 'opacity-55' : undefined}>
        {/* —— Landscape reference stack: cards → $ → name —— */}
        {landscape ? (
          <div
            className={`relative flex flex-col items-center ${
              isSelf && showCards ? 'w-[3.5rem]' : 'w-[3.4rem]'
            }`}
          >
            {(faceDown || showCards) && (
              isSelf && showCards ? (
                <HoleCardFan
                  cards={showCards}
                  handId={dealKey}
                  winningCards={winningCards}
                  compact
                />
              ) : (
                <div className="relative z-[1] mb-0.5 flex drop-shadow-md">
                  {faceDown ? (
                    <>
                      <div className="-mr-2 origin-bottom -rotate-[6deg]">
                        <PlayingCard
                          key={`${dealKey}-${player.seat}-back-0`}
                          faceDown
                          size={cardSize}
                          dealDelay={0}
                        />
                      </div>
                      <div className="origin-bottom rotate-[6deg]">
                        <PlayingCard
                          key={`${dealKey}-${player.seat}-back-1`}
                          faceDown
                          size={cardSize}
                          dealDelay={0.08}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="-mr-2 origin-bottom -rotate-[6deg]">
                        <PlayingCard
                          key={`${dealKey}-${player.seat}-${showCards![0]}`}
                          code={showCards![0]}
                          size={cardSize}
                          dealDelay={0}
                          highlight={!!winningCards?.has(showCards![0]!)}
                          dimmed={!!winningCards && !winningCards.has(showCards![0]!)}
                        />
                      </div>
                      <div className="origin-bottom rotate-[6deg]">
                        <PlayingCard
                          key={`${dealKey}-${player.seat}-${showCards![1]}`}
                          code={showCards![1]}
                          size={cardSize}
                          dealDelay={0.08}
                          highlight={!!winningCards?.has(showCards![1]!)}
                          dimmed={!!winningCards && !winningCards.has(showCards![1]!)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )
            )}

            <div className="relative z-[1] w-full overflow-hidden rounded shadow-[0_2px_6px_rgba(0,0,0,0.45)]">
              {isToAct && (
                <div className="pointer-events-none absolute -inset-1 z-0">
                  <SeatTurnRing endsAt={turnEndsAt} totalMs={turnTotalMs ?? 20000} active size={40} />
                </div>
              )}
              <div
                className={`relative px-0.5 py-0.5 text-center text-[10px] font-extrabold tabular-nums leading-none text-white ${
                  isWinner ? 'bg-[#c9a227]' : 'bg-[#c62828]'
                }`}
              >
                {money(player.stack)}
              </div>
              <div
                className={`truncate px-0.5 py-0.5 text-center text-[8px] font-bold leading-none ${
                  isSelf ? 'bg-[#f5c518] text-black' : 'bg-[#d8d8d8] text-black'
                }`}
              >
                {displayName}
              </div>
            </div>

            {folded && (
              <div className="mt-0.5 text-[7px] font-bold uppercase tracking-wider text-white/80">
                Fold
              </div>
            )}
            {player.status === 'allin' && (
              <div className="mt-0.5 text-[7px] font-bold uppercase tracking-wider text-[#2aff9a]">
                All-in
              </div>
            )}
          </div>
        ) : (
          <div
            className={`relative flex flex-col items-center ${
              compact ? 'w-[3.6rem] px-0 pb-0 pt-0' : 'px-2.5 pb-2 pt-1.5'
            }`}
          >
            {compact && isSelf && (faceDown || showCards) && (
              <div className="pointer-events-none absolute bottom-[calc(100%-0.85rem)] left-1/2 z-0 -translate-x-1/2">
                {faceDown ? (
                  <div className="flex items-end drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]">
                    <div className="relative z-[1] -mr-2 origin-bottom -rotate-[8deg]">
                      <PlayingCard
                        key={`${dealKey}-${player.seat}-back-0`}
                        faceDown
                        size="peek"
                        dealDelay={0}
                      />
                    </div>
                    <div className="relative z-[2] origin-bottom rotate-[8deg]">
                      <PlayingCard
                        key={`${dealKey}-${player.seat}-back-1`}
                        faceDown
                        size="peek"
                        dealDelay={0.08}
                      />
                    </div>
                  </div>
                ) : showCards ? (
                  <HoleCardFan
                    cards={showCards}
                    handId={dealKey}
                    winningCards={winningCards}
                    compact
                  />
                ) : null}
              </div>
            )}

            {renderCards && (faceDown || showCards) && !(compact && isSelf) && (
              isSelf && showCards ? (
                <HoleCardFan
                  cards={showCards}
                  handId={dealKey}
                  winningCards={winningCards}
                />
              ) : (
                <div className="relative z-[1] mb-0.5 flex gap-0.5 drop-shadow-md">
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
              )
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

            {compact ? (
              <div className="relative z-[1] flex w-full flex-col items-center">
                <div className="relative mb-0.5 shrink-0">
                  {isToAct && (
                    <div className="pointer-events-none absolute -inset-1">
                      <SeatTurnRing
                        endsAt={turnEndsAt}
                        totalMs={turnTotalMs ?? 20000}
                        active
                        size={isSelf ? 36 : 32}
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
                <div className="flex w-full flex-col overflow-hidden rounded-md shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
                  {isSelf && (
                    <span className="bg-[#f5c518] px-0.5 py-px text-center text-[6px] font-extrabold uppercase leading-none tracking-wide text-black">
                      You
                    </span>
                  )}
                  <span className="truncate bg-white px-0.5 py-0.5 text-center text-[8px] font-bold leading-none text-black">
                    {displayName}
                  </span>
                  <span
                    className={`px-0.5 py-0.5 text-center text-[10px] font-extrabold tabular-nums leading-none tracking-tight text-white ${
                      isWinner ? 'bg-[#c9a227]' : 'bg-[#c62828]'
                    }`}
                  >
                    {money(player.stack)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative z-[1] flex items-end gap-0.5">
                <div className="relative mb-0.5 shrink-0">
                  {isToAct && (
                    <div className="pointer-events-none absolute -inset-1">
                      <SeatTurnRing
                        endsAt={turnEndsAt}
                        totalMs={turnTotalMs ?? 20000}
                        active
                        size={isSelf ? 36 : 32}
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
                      className={`max-w-[3.2rem] truncate rounded-b-sm bg-white px-1.5 py-1 text-[10px] font-bold leading-none text-black sm:max-w-[3.6rem] ${
                        isSelf ? '' : 'rounded-sm'
                      }`}
                    >
                      {displayName}
                    </span>
                  </div>
                  <div
                    className={`flex min-w-[2.75rem] items-center justify-center px-1.5 py-1 text-[11px] font-extrabold tabular-nums tracking-tight text-white sm:min-w-[3.75rem] sm:px-2.5 sm:py-1.5 sm:text-[13px] ${
                      isWinner ? 'bg-[#c9a227]' : 'bg-[#c62828]'
                    }`}
                  >
                    {money(player.stack)}
                  </div>
                </div>
              </div>
            )}

            {handName && compact && (
              <div
                className={`relative z-[1] mt-0.5 max-w-full truncate rounded px-1 py-px text-[7px] font-bold tracking-wide ${
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
        )}

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
        {isBot && canManageBots && onRemoveBot && compact && !landscape && (
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
      </div>
    </>
  );
}
