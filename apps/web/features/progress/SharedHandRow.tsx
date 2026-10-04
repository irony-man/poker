'use client';

import { MoneyAmount } from '@/components/CurrencyIcon';
import { PlayingCard } from '@/components/PlayingCard';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatHandWhen, type PlayedHandLevel } from '@/features/progress/playedHand';

function HoleThumb({ cards }: { cards: [string, string] | null }) {
  return (
    <div className="flex shrink-0 items-end">
      <div className="-mr-2 origin-bottom -rotate-[6deg] sm:-mr-2.5">
        <PlayingCard code={cards?.[0]} faceDown={!cards} size="xs" dealDelay={0} />
      </div>
      <div className="relative z-[1] origin-bottom rotate-[5deg]">
        <PlayingCard code={cards?.[1]} faceDown={!cards} size="xs" dealDelay={0} />
      </div>
    </div>
  );
}

function SharedPlayerColumn({
  label,
  cards,
  winner,
}: {
  label: string;
  cards: [string, string] | null;
  winner?: boolean;
}) {
  return (
    <div className="flex min-w-[4.5rem] flex-col items-start gap-2 sm:min-w-[5.5rem]">
      <div className="flex max-w-full items-center gap-1.5">
        <span className="truncate text-xs font-semibold text-primary">{label}</span>
        {winner ? (
          <StatusChip tone="positive" className="!px-1.5 !py-0.5 text-[10px]">
            Won
          </StatusChip>
        ) : null}
      </div>
      <HoleThumb cards={cards} />
    </div>
  );
}

export function SharedHandRow({
  hand,
  handNumber,
  chipsWon,
}: {
  hand: PlayedHandLevel;
  handNumber?: number;
  chipsWon?: number | null;
}) {
  const when = formatHandWhen(hand.startedAt);
  const viewerSat = hand.shownPlayers.some((p) => p.isViewer);
  const winnerLabel = hand.won
    ? 'You won'
    : hand.winnerName
      ? `${hand.winnerName} won`
      : 'Hand complete';
  const others = hand.shownPlayers.filter((p) => !p.isViewer && p.holeCards);
  const amount = chipsWon ?? hand.winAmount;
  return (
    <li className="overflow-hidden rounded-2xl border border-sidebar/12 bg-white p-4 shadow-[0_4px_16px_rgb(29_4_50_/_0.04)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="min-w-0 text-sm font-semibold text-primary">
          {handNumber != null ? (
            <span className="mr-2 font-mono text-xs font-semibold text-muted">#{handNumber}</span>
          ) : null}
          <span className={hand.won ? 'text-positive' : 'text-sidebar'}>{winnerLabel}</span>
          {hand.handName && hand.handName !== 'Uncontested' ? (
            <span className="font-medium text-muted"> · {hand.handName}</span>
          ) : null}
        </p>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
          {amount != null && amount > 0 ? (
            <MoneyAmount
              amount={amount}
              prefix="+"
              showChips
              className="font-mono font-semibold text-sidebar"
            />
          ) : null}
          <span>
            {when || 'Unknown time'}
            {hand.source === 'offline' ? ' · Solo' : ''}
          </span>
        </div>
      </div>

      {viewerSat || others.length > 0 || hand.community.length > 0 || hand.holeCards ? (
        <div className="mt-4 space-y-3 rounded-xl bg-sidebar/[0.07] p-3 ring-1 ring-inset ring-sidebar/12 sm:p-3.5">
          <div className="flex flex-wrap items-end gap-5 sm:gap-7">
            {viewerSat ? (
              <SharedPlayerColumn label="You" cards={hand.holeCards} winner={hand.won} />
            ) : null}
            {others.map((p) => (
              <SharedPlayerColumn
                key={p.userId || p.name}
                label={p.name}
                cards={p.holeCards}
                winner={p.isWinner}
              />
            ))}
            {!viewerSat && others.length === 0 && hand.holeCards ? (
              <SharedPlayerColumn label="You" cards={hand.holeCards} winner={hand.won} />
            ) : null}
          </div>

          {hand.community.length > 0 ? (
            <div className="border-t border-sidebar/10 pt-3">
              <p className="mb-2 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-muted">
                Board
              </p>
              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {hand.community.map((code, i) => (
                  <PlayingCard key={`${code}-${i}`} code={code} size="xs" dealDelay={0} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
