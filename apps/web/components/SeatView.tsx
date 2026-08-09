'use client';

import { ChipStack, formatChips } from './ChipStack';
import { HoleCardFan, PlayingCard, type CardSize } from './PlayingCard';
import { PlayerAvatar } from './PlayerAvatar';
import { isSeatActionLabel } from '@/lib/seatAction';
import { SeatTurnRing } from './TurnTimer';
import { useSession, type PublicPlayer } from '@/lib/store';

function money(n: number): string {
  return formatChips(n);
}

function SeatActionPopup({ label, burstKey }: { label: string; burstKey: number }) {
  return (
    <div
      key={burstKey}
      className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-[115%]"
    >
      <span className="seat-action-popup inline-block whitespace-nowrap rounded-lg border-2 border-mushroom/55 bg-sidebar/95 px-3.5 py-1.5 text-sm font-extrabold uppercase tracking-wide text-mushroom shadow-[0_6px_18px_rgba(14,6,24,0.65)]">
        {label}
      </span>
    </div>
  );
}

/** Seat-corner control so win chrome (+amount / hand name) does not push Kick outside the felt clip. */
function SeatKickButton({
  onKick,
  compact,
}: {
  onKick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onKick}
      aria-label="Kick player"
      className={
        compact
          ? 'absolute -right-1 -top-1 z-30 flex h-4 min-w-4 items-center justify-center rounded-full bg-black/70 px-0.5 text-[9px] font-bold leading-none text-white/70 hover:bg-red-950/90 hover:text-red-300'
          : 'absolute -right-1.5 -top-1.5 z-30 rounded bg-black/70 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70 shadow hover:bg-red-950/90 hover:text-red-300'
      }
    >
      {compact ? '×' : 'Kick'}
    </button>
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
  onKick,
  canManageBots,
  spectating,
  angle,
  compact = false,
  landscape = false,
  isDealer = false,
  showReady = false,
  canKick = false,
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
  onKick?: () => void;
  canManageBots?: boolean;
  spectating?: boolean;
  angle: number;
  /** Portrait / narrow: push seats to rim, shrink cards & chrome. */
  compact?: boolean;
  /** Rotated phone — reference-style stacked cards → stack → name. */
  landscape?: boolean;
  isDealer?: boolean;
  showReady?: boolean;
  canKick?: boolean;
}) {
  const rad = (angle * Math.PI) / 180;
  const rx = landscape ? 41 : compact ? 42 : 41;
  const ry = landscape ? 34 : compact ? 40 : 37;
  const x = 50 + Math.cos(rad) * rx;
  const y = 50 + Math.sin(rad) * ry;
  const isBot = !!player.userId?.startsWith('bot:');
  const actionBurst = useSession((s) => s.actionBurst);
  /** Show Call/Fold/etc float on this seat only while the burst is live. */
  const showAction =
    actionBurst != null &&
    actionBurst.seat === player.seat &&
    isSeatActionLabel(actionBurst.label);

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
  const showKick = canKick && !!onKick && !(isBot && canManageBots);

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
        {/* —— Landscape reference: cards → red $ → name; D on dealer —— */}
        {landscape ? (
          <div
            className={`relative flex flex-col items-center ${
              isSelf && showCards ? 'w-[4.25rem]' : 'w-[3.6rem]'
            }`}
          >
            {isDealer && (
              <span className="absolute -right-1 top-0 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-sidebar text-[9px] font-black text-mushroom shadow ring-1 ring-mushroom/40">
                D
              </span>
            )}

            {folded && (
              <div className="mb-0.5 font-display text-[12px] font-semibold tracking-wide text-white drop-shadow">
                Fold
              </div>
            )}

            {(faceDown || showCards) && !folded && (
              isSelf && showCards ? (
                <div
                  className={`relative mb-1 ${
                    isToAct ? 'rounded-full p-1 ring-1 ring-dashed ring-white/45' : ''
                  }`}
                >
                  <HoleCardFan
                    cards={showCards}
                    handId={dealKey}
                    winningCards={winningCards}
                    compact
                  />
                </div>
              ) : (
                <div className="relative z-[1] mb-1 flex drop-shadow-md">
                  {faceDown ? (
                    <>
                      <div className="-mr-2.5 origin-bottom -rotate-[8deg]">
                        <PlayingCard
                          key={`${dealKey}-${player.seat}-back-0`}
                          faceDown
                          size="sm"
                          dealDelay={0}
                        />
                      </div>
                      <div className="origin-bottom rotate-[8deg]">
                        <PlayingCard
                          key={`${dealKey}-${player.seat}-back-1`}
                          faceDown
                          size="sm"
                          dealDelay={0.08}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="-mr-2.5 origin-bottom -rotate-[8deg]">
                        <PlayingCard
                          key={`${dealKey}-${player.seat}-${showCards![0]}`}
                          code={showCards![0]}
                          size="sm"
                          dealDelay={0}
                          highlight={!!winningCards?.has(showCards![0]!)}
                          dimmed={!!winningCards && !winningCards.has(showCards![0]!)}
                        />
                      </div>
                      <div className="origin-bottom rotate-[8deg]">
                        <PlayingCard
                          key={`${dealKey}-${player.seat}-${showCards![1]}`}
                          code={showCards![1]}
                          size="sm"
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

            <div className="relative z-[1] w-full rounded shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
              {showKick && onKick && <SeatKickButton onKick={onKick} compact />}
              {isToAct && (
                <div className="pointer-events-none absolute -inset-1 z-0">
                  <SeatTurnRing endsAt={turnEndsAt} totalMs={turnTotalMs ?? 20000} active size={44} />
                </div>
              )}
              <div className="overflow-hidden rounded">
                <div
                  className={`relative px-1 py-0.5 text-center text-[11px] font-extrabold tabular-nums leading-none text-mushroom ${
                    isWinner ? 'bg-brass text-ink' : 'bg-sidebar'
                  }`}
                >
                  {money(player.stack)}
                </div>
                <div
                  className={`truncate px-1 py-0.5 text-center text-[10px] font-bold leading-none ${
                    isSelf ? 'bg-mushroom text-sidebar' : 'bg-[#efe6e4] text-sidebar'
                  }`}
                >
                  {displayName}
                </div>
              </div>
            </div>

            {player.status === 'allin' && !folded && (
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-mushroom drop-shadow">
                All-in
              </div>
            )}
            {sittingOut && (
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200 drop-shadow">
                Out
              </div>
            )}
            {!sittingOut && player.pendingSitOut && (
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200 drop-shadow">
                Out next
              </div>
            )}
            {showReady && !sittingOut && !player.pendingSitOut && (
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-mushroom drop-shadow">
                Ready
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
                    className="relative z-[1]"
                  />
                </div>
                <div className="relative w-full">
                  {showKick && onKick && <SeatKickButton onKick={onKick} compact />}
                  <div className="flex w-full flex-col overflow-hidden rounded-md shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
                    {isSelf && (
                      <span className="bg-mushroom px-0.5 py-px text-center text-[6px] font-extrabold uppercase leading-none tracking-wide text-sidebar">
                        You
                      </span>
                    )}
                    <span className="truncate bg-[#efe6e4] px-0.5 py-0.5 text-center text-[8px] font-bold leading-none text-sidebar">
                      {displayName}
                    </span>
                    <span
                      className={`px-0.5 py-0.5 text-center text-[10px] font-extrabold tabular-nums leading-none tracking-tight ${
                        isWinner ? 'bg-brass text-ink' : 'bg-sidebar text-mushroom'
                      }`}
                    >
                      {money(player.stack)}
                    </span>
                  </div>
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
                    className="relative z-[1]"
                  />
                </div>
                <div className="relative flex items-stretch shadow-[0_3px_8px_rgba(0,0,0,0.45)]">
                  {showKick && onKick && <SeatKickButton onKick={onKick} />}
                  <div className="flex flex-col justify-end">
                    {isSelf && (
                      <span className="rounded-t-sm bg-mushroom px-1 py-[1px] text-center text-[7px] font-extrabold uppercase leading-tight tracking-wide text-sidebar">
                        You
                      </span>
                    )}
                    <span
                      className={`max-w-[3.2rem] truncate rounded-b-sm bg-[#efe6e4] px-1.5 py-1 text-[10px] font-bold leading-none text-sidebar sm:max-w-[3.6rem] ${
                        isSelf ? '' : 'rounded-sm'
                      }`}
                    >
                      {displayName}
                    </span>
                  </div>
                  <div
                    className={`flex min-w-[2.75rem] items-center justify-center px-1.5 py-1 text-[11px] font-extrabold tabular-nums tracking-tight sm:min-w-[3.75rem] sm:px-2.5 sm:py-1.5 sm:text-[13px] ${
                      isWinner
                        ? 'bg-brass text-ink'
                        : 'bg-sidebar text-mushroom'
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
              <div className="relative z-[1] mt-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-mushroom">
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
            {!sittingOut && player.pendingSitOut && (
              <div className="relative z-[1] mt-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-amber-200/90">
                Out next
              </div>
            )}
            {showReady && !sittingOut && !player.pendingSitOut && (
              <div className="relative z-[1] mt-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-mushroom">
                Ready
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
