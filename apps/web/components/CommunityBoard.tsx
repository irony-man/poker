'use client';

import { PlayingCard, type CardSize } from './PlayingCard';

/** Community / board cards — single row on desktop, two rows on mobile. */
export function CommunityBoard({
  cards,
  handId,
  cardSize = 'md',
  highlightMode = false,
  winningCards,
  dealing = false,
}: {
  cards: string[];
  handId?: string | null;
  cardSize?: CardSize;
  highlightMode?: boolean;
  winningCards?: Set<string>;
  /** Show “Dealing…” when street is live but board is empty. */
  dealing?: boolean;
}) {
  if (cards.length === 0) {
    return (
      <div className="flex min-h-[4.25rem] items-center justify-center sm:min-h-[5.25rem]">
        {dealing ? (
          <span className="text-cream/40 text-xs font-display uppercase tracking-wider">Dealing…</span>
        ) : null}
      </div>
    );
  }

  const card = (c: string, i: number) => (
    <PlayingCard
      key={`${handId ?? 'board'}-${c}-${i}`}
      code={c}
      size={cardSize}
      dealDelay={i * 0.07}
      highlight={highlightMode && !!winningCards?.has(c)}
      dimmed={highlightMode && !winningCards?.has(c)}
    />
  );

  return (
    <>
      {/* Mobile: flop row + turn/river row */}
      <div className="flex flex-col items-center gap-1 sm:hidden">
        <div className="flex items-center justify-center gap-1">
          {cards.slice(0, 3).map((c, i) => card(c, i))}
        </div>
        {cards.length > 3 && (
          <div className="flex items-center justify-center gap-1">
            {cards.slice(3).map((c, i) => card(c, i + 3))}
          </div>
        )}
      </div>
      {/* sm+: single row */}
      <div className="hidden items-center gap-1.5 sm:flex sm:min-h-[5.25rem]">
        {cards.map((c, i) => card(c, i))}
      </div>
    </>
  );
}
