'use client';

import { ChipDisc } from '../ChipStack';
import { CommunityBoard } from '../CommunityBoard';
import { HoleCardFan } from '../PlayingCard';
import { PlayerAvatar } from '../PlayerAvatar';
import { formatMoneyAmount } from '@/lib/currency';
import { computeHeroHandName } from '@/lib/heroHudOdds';
import type { PrivateView, PublicPlayer, PublicTable } from '@/lib/store';

function OpponentSeat({
  player,
  isToAct,
  isDealer,
  onSit,
}: {
  player: PublicPlayer;
  isToAct: boolean;
  isDealer: boolean;
  onSit?: () => void;
}) {
  const empty = player.status === 'empty';
  const folded = player.status === 'folded';
  const sittingOut = player.status === 'sittingOut';

  if (empty) {
    return (
      <button
        type="button"
        disabled={!onSit}
        onClick={onSit}
        className="flex min-w-0 flex-1 flex-col items-center gap-1 disabled:opacity-50"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/30 text-[10px] font-semibold uppercase tracking-wide text-white/45">
          Sit
        </span>
        <span className="text-[10px] font-medium text-white/35">Open</span>
      </button>
    );
  }

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 ${
        folded || sittingOut ? 'opacity-45' : ''
      }`}
    >
      <div className="relative">
        <div
          className={`overflow-hidden rounded-full ${
            isToAct ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''
          }`}
        >
          <PlayerAvatar
            avatarId={player.avatarId}
            avatarUrl={player.avatarUrl}
            userId={player.userId}
            size={48}
            title={player.name ?? 'Player'}
          />
        </div>
        {isDealer ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] font-black text-black">
            D
          </span>
        ) : null}
      </div>
      <span className="max-w-full truncate text-[11px] font-semibold text-white">
        {player.name ?? 'Player'}
      </span>
      <span className="text-[11px] font-medium tabular-nums text-white/70">
        {formatMoneyAmount(player.stack)}
      </span>
      {player.bet > 0 ? (
        <span className="mt-0.5">
          <ChipDisc amount={player.bet} size={22} showValue />
        </span>
      ) : (
        <span className="h-[22px]" />
      )}
    </div>
  );
}

export function StackedTableLayout({
  table,
  priv,
  userId,
  spectating,
  potTotal,
  highlightMode,
  winningCards,
  onSit,
  canSit,
}: {
  table: PublicTable;
  priv: PrivateView | null;
  userId: string | null;
  spectating: boolean;
  potTotal: number;
  highlightMode: boolean;
  winningCards?: Set<string>;
  onSit?: (seat: number) => void;
  canSit?: boolean;
}) {
  const mySeat = table.players.find((p) => p.userId === userId)?.seat;
  const hero = mySeat !== undefined ? table.players[mySeat] : undefined;
  const opponents = table.players.filter((p) => p.seat !== mySeat);
  const hole = priv?.holeCards ?? null;
  const inHand =
    table.street !== 'waiting' &&
    table.street !== 'payout' &&
    table.street !== 'showdown';
  const handName = hole && inHand ? computeHeroHandName(hole, table.community) : null;
  const showHeroHud = !spectating && mySeat !== undefined;

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden felt-surface px-3 pb-3 pt-2">
      <div
        className={`flex shrink-0 justify-center gap-1 ${
          opponents.length > 6 ? 'flex-wrap' : ''
        }`}
      >
        {opponents.map((p) => (
          <OpponentSeat
            key={p.seat}
            player={p}
            isToAct={table.toAct === p.seat}
            isDealer={table.dealerButton === p.seat}
            onSit={
              canSit && p.status === 'empty' && onSit ? () => onSit(p.seat) : undefined
            }
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <CommunityBoard
          cards={table.community}
          handId={table.handId}
          cardSize="lg"
          fillSlots={5}
          highlightMode={highlightMode}
          winningCards={winningCards}
          street={table.street}
        />
        <div className="flex flex-col items-center gap-1">
          <span className="font-display text-4xl font-extrabold tabular-nums tracking-tight text-white drop-shadow-md">
            {formatMoneyAmount(Math.max(potTotal, table.pot))}
          </span>
          {hero && hero.bet > 0 ? (
            <ChipDisc amount={hero.bet} size={22} showValue />
          ) : (
            <ChipDisc amount={Math.max(potTotal, table.pot, 1)} size={22} />
          )}
        </div>
      </div>

      {showHeroHud ? (
        <div className="mt-2 flex shrink-0 flex-col items-center">
          {handName ? (
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/55">
              {handName}
            </p>
          ) : hero?.status === 'folded' ? (
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/45">
              Folded
            </p>
          ) : null}
          {hole ? (
            <HoleCardFan
              cards={hole}
              large
              handId={table.handId}
              winningCards={highlightMode ? winningCards : null}
            />
          ) : (
            <div className="h-[7.25rem]" />
          )}
        </div>
      ) : (
        <div className="h-2 shrink-0" />
      )}
    </div>
  );
}
