'use client';

import type { MemoryCardView } from '@poker/protocol';
import { cn } from '@/lib/cn';

const PAIR_GLYPHS = [
  '♠',
  '♥',
  '♦',
  '♣',
  '★',
  '◆',
  '●',
  '▲',
  '■',
  '☀',
  '☾',
  '✦',
  '✿',
  '☘',
  '⚓',
  '⚑',
  '⚡',
  '❄',
];

function glyphForPair(pairId: number | null): string {
  if (pairId == null) return '?';
  return PAIR_GLYPHS[pairId % PAIR_GLYPHS.length] ?? String(pairId + 1);
}

export function MemoryBoard({
  cards,
  gridSize,
  canFlip,
  onFlip,
}: {
  cards: MemoryCardView[];
  gridSize: 16 | 36;
  canFlip: boolean;
  onFlip: (index: number) => void;
}) {
  const cols = gridSize === 36 ? 6 : 4;

  return (
    <div
      className="mx-auto grid w-full max-w-lg gap-1.5 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      role="grid"
      aria-label="Memory match board"
    >
      {cards.map((card) => {
        const showFace = card.matched || card.faceUp;
        const clickable = canFlip && !card.matched && !card.faceUp;
        return (
          <button
            key={card.index}
            type="button"
            role="gridcell"
            disabled={!clickable}
            onClick={() => onFlip(card.index)}
            className={cn(
              'aspect-square rounded-lg border text-lg font-display font-bold transition sm:text-xl',
              showFace
                ? card.matched
                  ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                  : 'border-brass/50 bg-brass/25 text-on-chrome'
                : 'border-on-chrome/20 bg-raised text-on-chrome/40 hover:border-on-chrome/40',
              clickable && 'cursor-pointer active:scale-[0.97]',
              !clickable && !showFace && 'cursor-default opacity-80',
            )}
            aria-label={
              showFace
                ? `Card ${card.index + 1}, ${glyphForPair(card.pairId)}`
                : `Card ${card.index + 1}, face down`
            }
          >
            {showFace ? glyphForPair(card.pairId) : '·'}
          </button>
        );
      })}
    </div>
  );
}
