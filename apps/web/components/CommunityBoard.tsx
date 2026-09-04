'use client';

import type { ReactNode } from 'react';
import { PlayingCard, speakCard, type CardSize } from './PlayingCard';

function emptyBoardLabel(street: string | undefined): string | null {
  switch (street) {
    case 'preflop':
      return 'Preflop';
    case 'flop':
      return 'Flop';
    case 'turn':
      return 'Turn';
    case 'river':
      return 'River';
    case 'showdown':
    case 'payout':
      return null;
    case 'waiting':
    case undefined:
      return null;
    default:
      // Brief transition before street is fully applied
      return 'Dealing…';
  }
}

/** Community / board cards — single row on desktop, two rows when compact. */
export function CommunityBoard({
  cards,
  handId,
  cardSize = 'md',
  highlightMode = false,
  winningCards,
  street,
  compact = false,
  /** Phone landscape: one centered row of larger faces. */
  landscape = false,
  /** Always render this many slots; undealt streets are face-down backs. */
  fillSlots,
}: {
  cards: string[];
  handId?: string | null;
  cardSize?: CardSize;
  highlightMode?: boolean;
  winningCards?: Set<string>;
  /** Table street — used for empty-board status (avoid forever “Dealing…” on preflop). */
  street?: string | null;
  /** Force phone layout (portrait or landscape) — ignore Tailwind sm: breakpoints. */
  compact?: boolean;
  landscape?: boolean;
  fillSlots?: number;
}) {
  const size: CardSize = landscape ? 'sm' : compact ? 'board' : cardSize;
  const emptyLabel = emptyBoardLabel(street ?? undefined);
  const boardName = cards.length
    ? `Community cards, ${street ?? 'board'}: ${cards.map(speakCard).join(', ')}`
    : `Community cards${emptyLabel ? `, ${emptyLabel}` : ''}`;

  const wrap = (node: ReactNode) => (
    <div role="group" aria-label={boardName}>
      {node}
    </div>
  );
  const card = (c: string, i: number) => (
    <PlayingCard
      key={`${handId ?? 'board'}-${c}-${i}`}
      code={c}
      size={size}
      dealDelay={i * 0.07}
      highlight={highlightMode && !!winningCards?.has(c)}
      dimmed={highlightMode && !winningCards?.has(c)}
    />
  );
  const slotCount = fillSlots && fillSlots > 0 ? fillSlots : 0;
  const slots =
    slotCount > 0
      ? Array.from({ length: slotCount }, (_, i) => cards[i] ?? null)
      : null;

  if (slots) {
    return wrap(
      <div className="flex items-center justify-center gap-1.5">
        {slots.map((c, i) =>
          c ? (
            card(c, i)
          ) : (
            <PlayingCard
              key={`${handId ?? 'board'}-back-${i}`}
              faceDown
              size={size}
              dealDelay={i * 0.04}
            />
          ),
        )}
      </div>,
    );
  }

  if (cards.length === 0) {
    return wrap(
      <div
        className={`flex items-center justify-center ${
          compact || landscape ? 'min-h-[2.75rem]' : 'min-h-[4.25rem] sm:min-h-[5.25rem]'
        }`}
      >
        {emptyLabel ? (
          <span className="table-label-on-felt text-xs font-display uppercase tracking-[0.18em]">
            {emptyLabel}
          </span>
        ) : null}
      </div>,
    );
  }

  if (landscape) {
    return wrap(
      <div className="flex items-center justify-center gap-1 drop-shadow-lg">
        {cards.map((c, i) => card(c, i))}
      </div>,
    );
  }

  if (compact) {
    return wrap(
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center justify-center gap-0.5">
          {cards.slice(0, 3).map((c, i) => card(c, i))}
        </div>
        {cards.length > 3 && (
          <div className="flex items-center justify-center gap-0.5">
            {cards.slice(3).map((c, i) => card(c, i + 3))}
          </div>
        )}
      </div>,
    );
  }

  return wrap(
    <>
      {/* Mobile: flop row + turn/river row */}
      <div className="flex flex-col items-center gap-0.5 sm:hidden">
        <div className="flex items-center justify-center gap-0.5">
          {cards.slice(0, 3).map((c, i) => card(c, i))}
        </div>
        {cards.length > 3 && (
          <div className="flex items-center justify-center gap-0.5">
            {cards.slice(3).map((c, i) => card(c, i + 3))}
          </div>
        )}
      </div>
      {/* sm+: single row */}
      <div className="hidden items-center gap-1 sm:flex sm:min-h-[5.25rem]">
        {cards.map((c, i) => card(c, i))}
      </div>
    </>,
  );
}
