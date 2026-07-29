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

const SIZE = {
  /** Opponents on narrow phones */
  xs: 'w-7 h-[2.625rem] sm:w-12 sm:h-[4.5rem]',
  /** Opponents / compact */
  sm: 'w-9 h-[3.375rem] sm:w-14 sm:h-[5.25rem]',
  /** Board + hero on mobile; full size on desktop */
  md: 'w-11 h-[4.125rem] sm:w-20 sm:h-[7.5rem] md:w-24 md:h-36',
  /** Legacy default (desktop-first) */
  lg: 'w-14 h-[5.25rem] sm:w-24 sm:h-36',
} as const;

export type CardSize = keyof typeof SIZE;

export function PlayingCard({
  code,
  faceDown = false,
  small = false,
  size,
  highlight = false,
  dimmed = false,
  /** Stagger delay for the one-shot deal-in (seconds). */
  dealDelay = 0,
}: {
  code?: string;
  faceDown?: boolean;
  /** @deprecated Prefer `size="sm"` */
  small?: boolean;
  size?: CardSize;
  /** Part of the winning five-card hand at showdown. */
  highlight?: boolean;
  /** Showdown: not used in a winning hand. */
  dimmed?: boolean;
  dealDelay?: number;
}) {
  const resolved: CardSize = size ?? (small ? 'sm' : 'md');
  const w = SIZE[resolved];
  const radius = resolved === 'xs' || resolved === 'sm' ? 'rounded-md' : 'rounded-lg sm:rounded-xl';
  const winRing = highlight
    ? 'ring-2 ring-gold shadow-[0_0_22px_rgba(232,185,74,0.65)] scale-105 z-10'
    : 'ring-1 ring-black/25';
  const dim = dimmed && !highlight ? 'opacity-35 saturate-50' : '';
  const shell = `${w} ${radius} relative overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.55)] ${winRing} ${dim} bg-[#f7f2e8] transition-[opacity,transform,box-shadow] duration-300`;

  if (faceDown || !code) {
    const Back = deck.B2 as CardSvg;
    return (
      <motion.div
        initial={{ rotateY: 88, opacity: 0, scale: 0.9 }}
        animate={{ rotateY: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: dealDelay }}
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
      transition={{ type: 'spring', stiffness: 320, damping: 22, delay: dealDelay }}
      className={shell}
    >
      <CardFace DeckCard={Face} className="w-full h-full" />
      {highlight && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent" />
      )}
    </motion.div>
  );
}
