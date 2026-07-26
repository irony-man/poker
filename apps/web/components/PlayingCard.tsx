'use client';

import { motion } from 'framer-motion';
import type { ComponentType, SVGProps } from 'react';
import * as deck from '@letele/playing-cards';

type CardSvg = ComponentType<SVGProps<SVGSVGElement>>;

/** Map engine codes (`Ah`, `Td`) to @letele keys (`Ha`, `D10`). */
function toDeckKey(code: string): string | null {
  if (code.length !== 2) return null;
  const rankChar = code[0]!.toUpperCase();
  const suit = code[1]!.toUpperCase();
  if (!'HDCS'.includes(suit)) return null;

  const rank =
    rankChar === 'T'
      ? '10'
      : rankChar === 'A' || rankChar === 'J' || rankChar === 'Q' || rankChar === 'K'
        ? rankChar.toLowerCase()
        : rankChar;

  if (!rank.match(/^(10|[2-9ajqk])$/)) return null;
  return `${suit}${rank}`;
}

function CardFace({
  DeckCard,
  className,
}: {
  DeckCard: CardSvg;
  className: string;
}) {
  return (
    <DeckCard
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
      role="img"
    />
  );
}

export function PlayingCard({
  code,
  faceDown = false,
  small = false,
}: {
  code?: string;
  faceDown?: boolean;
  small?: boolean;
}) {
  // small = opponents; default = your hole cards / board
  const w = small
    ? 'w-12 h-[4.5rem] sm:w-14 sm:h-[5.25rem]'
    : 'w-20 h-[7.5rem] sm:w-24 sm:h-36';
  const radius = small ? 'rounded-lg' : 'rounded-xl';
  const shell = `${w} ${radius} relative overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.55)] ring-1 ring-black/25 bg-[#f7f2e8]`;

  if (faceDown || !code) {
    const Back = deck.B2 as CardSvg;
    return (
      <motion.div
        initial={{ rotateY: 88, opacity: 0, scale: 0.9 }}
        animate={{ rotateY: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        style={{ transformStyle: 'preserve-3d' }}
        className={shell}
      >
        <CardFace DeckCard={Back} className="w-full h-full" />
      </motion.div>
    );
  }

  const key = toDeckKey(code);
  const Face = key ? (deck as Record<string, CardSvg | undefined>)[key] : undefined;

  if (!Face) {
    // Fallback if an unexpected code slips through
    return (
      <div className={`${shell} flex items-center justify-center text-xs text-ink/70`}>
        {code}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ y: -36, opacity: 0, rotateZ: -8 }}
      animate={{ y: 0, opacity: 1, rotateZ: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className={shell}
    >
      <CardFace DeckCard={Face} className="w-full h-full" />
    </motion.div>
  );
}
