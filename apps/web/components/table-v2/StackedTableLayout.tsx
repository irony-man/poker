'use client';

import { ChipDisc, ChipStack } from '../ChipStack';
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
  focused,
  onFocus,
  winPct,
  showCards,
}: {
  player: PublicPlayer;
  isToAct: boolean;
  isDealer: boolean;
  onSit?: () => void;
  focused?: boolean;
  onFocus?: () => void;
  winPct?: number | null;
  showCards?: boolean;
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
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/40 text-[10px] font-semibold uppercase tracking-wide text-white/80">
          Sit
        </span>
        <span className="text-[10px] font-medium text-on-chrome/85">Open</span>
      </button>
    );
  }

  const body = (
    <>
      <div className="relative">
        <div
          className={`overflow-hidden rounded-full ${
            isToAct ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''
          } ${focused ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-transparent' : ''}`}
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
        {winPct != null ? (
          <span className="absolute -left-1 -top-1 rounded bg-black/75 px-1 py-0.5 text-[9px] font-bold tabular-nums text-amber-200">
            {winPct}%
          </span>
        ) : null}
      </div>
      <span
        className={`max-w-full truncate text-[11px] font-semibold ${
          folded || sittingOut ? 'text-on-chrome/80' : 'text-white'
        }`}
      >
        {player.name ?? 'Player'}
      </span>
      <span
        className={`text-[11px] font-medium tabular-nums ${
          folded || sittingOut ? 'text-on-chrome/80' : 'table-label-on-felt'
        }`}
      >
        {formatMoneyAmount(player.stack)}
      </span>
      {showCards && player.holeCards ? (
        <HoleCardFan cards={player.holeCards} compact />
      ) : null}
      {player.bet > 0 ? (
        <span className="mt-0.5">
          <ChipDisc amount={player.bet} size={22} showValue />
        </span>
      ) : (
        <span className="h-[22px]" />
      )}
    </>
  );

  if (onFocus) {
    return (
      <button
        type="button"
        onClick={onFocus}
        className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
      >
        {body}
      </button>
    );
  }

  return <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">{body}</div>;
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
  focusedSeat,
  onFocusSeat,
  winPctBySeat,
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
  focusedSeat?: number | null;
  onFocusSeat?: (seat: number) => void;
  winPctBySeat?: Map<number, number>;
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
  const potAmount = Math.max(potTotal, table.pot);
  const sidePotCount = table.sidePots?.length ?? 0;

  const focusPlayer =
    spectating && focusedSeat != null
      ? table.players.find((p) => p.seat === focusedSeat)
      : undefined;
  const focusHole = focusPlayer?.holeCards ?? null;
  const focusHandName =
    focusHole != null ? computeHeroHandName(focusHole, table.community) : null;
  const focusWinPct =
    focusedSeat != null && winPctBySeat?.has(focusedSeat)
      ? winPctBySeat.get(focusedSeat)!
      : null;

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
            focused={spectating && focusedSeat === p.seat}
            onFocus={
              spectating && p.status !== 'empty' && onFocusSeat
                ? () => onFocusSeat(p.seat)
                : undefined
            }
            winPct={
              p.holeCards && winPctBySeat?.has(p.seat) ? winPctBySeat.get(p.seat)! : null
            }
            showCards={Boolean(p.holeCards)}
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
          <div className="flex items-end gap-3">
            <ChipStack amount={Math.max(potAmount, 1)} size="md" label={false} />
            <span className="font-display text-4xl font-extrabold tabular-nums tracking-tight text-white drop-shadow-md">
              {formatMoneyAmount(potAmount)}
            </span>
            {hero && hero.bet > 0 ? (
              <ChipDisc amount={hero.bet} size={22} showValue />
            ) : null}
          </div>
          {sidePotCount > 1 ? (
            <span className="rounded bg-black/45 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-on-chrome/85">
              {sidePotCount} pots
            </span>
          ) : null}
        </div>
      </div>

      {showHeroHud ? (
        <div className="mt-2 flex shrink-0 flex-col items-center">
          {handName ? (
            <p className="table-label-on-felt mb-1 text-xs font-medium uppercase tracking-wide text-on-chrome/85">
              {handName}
            </p>
          ) : hero?.status === 'folded' ? (
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-on-chrome/85">
              Folded
            </p>
          ) : null}
          {hero ? (
            <div className="mb-1.5 flex items-end gap-2">
              {hero.stack > 0 ? <ChipStack amount={hero.stack} size="md" label={false} /> : null}
              <span className="font-display text-lg font-extrabold tabular-nums text-white drop-shadow-md">
                {formatMoneyAmount(hero.stack)}
              </span>
            </div>
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
      ) : spectating ? (
        <div className="mt-2 flex shrink-0 flex-col items-center">
          {focusPlayer ? (
            <>
              <p className="mb-0.5 max-w-full truncate text-xs font-semibold text-white">
                {focusPlayer.name ?? `Seat ${focusPlayer.seat}`}
                {focusWinPct != null ? (
                  <span className="ml-2 tabular-nums text-amber-200">{focusWinPct}%</span>
                ) : null}
              </p>
              {focusHandName ? (
                <p className="table-label-on-felt mb-1 text-xs font-medium uppercase tracking-wide text-on-chrome/85">
                  {focusHandName}
                </p>
              ) : null}
              {focusHole ? (
                <HoleCardFan
                  cards={focusHole}
                  large
                  handId={table.handId}
                  winningCards={highlightMode ? winningCards : null}
                />
              ) : (
                <p className="mb-2 text-[11px] text-on-chrome/75">
                  {focusPlayer.mucked ? 'Mucked' : 'Hand not shown'}
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-on-chrome/75">Tap a player to focus</p>
          )}
        </div>
      ) : (
        <div className="h-2 shrink-0" />
      )}
    </div>
  );
}
