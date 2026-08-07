'use client';

import { motion } from 'framer-motion';

const SIZE = {
  xs: 'w-7 h-[2.625rem] sm:w-12 sm:h-[4.5rem]',
  sm: 'w-9 h-[3.375rem] sm:w-14 sm:h-[5.25rem]',
  md: 'w-11 h-[4.125rem] sm:w-20 sm:h-[7.5rem] md:w-24 md:h-36',
  lg: 'w-14 h-[5.25rem] sm:w-24 sm:h-36',
  peek: 'w-8 h-[3rem]',
  board: 'w-9 h-[3.375rem]',
  hand: 'w-12 h-[4.5rem] sm:w-16 sm:h-[6rem]',
  handSm: 'w-9 h-[3.4rem]',
} as const;

export type CardSize = keyof typeof SIZE;

const RANK_LABEL: Record<string, string> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  T: '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
};

const SUIT_GLYPH: Record<string, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

function parseCode(
  code: string,
): { rankChar: string; rank: string; suit: string; red: boolean } | null {
  if (code.length !== 2) return null;
  const rankChar = code[0]!.toUpperCase();
  const suit = code[1]!.toLowerCase();
  if (!RANK_LABEL[rankChar] || !SUIT_GLYPH[suit]) return null;
  return {
    rankChar,
    rank: RANK_LABEL[rankChar]!,
    suit: SUIT_GLYPH[suit]!,
    red: suit === 'h' || suit === 'd',
  };
}

function isTiny(size: CardSize) {
  return (
    size === 'peek' ||
    size === 'xs' ||
    size === 'board' ||
    size === 'sm' ||
    size === 'handSm'
  );
}

/**
 * Classic modern face: top-left rank + suit, top-right suit, large center suit,
 * soft sheen on white stock.
 */
function CardFace({
  rank,
  suit,
  red,
  size,
}: {
  rank: string;
  suit: string;
  red: boolean;
  size: CardSize;
}) {
  const color = red ? 'text-[#e53935]' : 'text-[#111111]';
  const tiny = isTiny(size);
  const isTen = rank === '10';

  const rankClass = tiny
    ? isTen
      ? 'text-[9px] leading-none'
      : 'text-[11px] leading-none'
    : isTen
      ? 'text-[13px] sm:text-[17px] leading-none'
      : 'text-[15px] sm:text-[20px] leading-none';

  const cornerSuit = tiny ? 'text-[9px] leading-none' : 'text-[12px] sm:text-[15px] leading-none';
  const topRightSuit = tiny ? 'text-[12px] leading-none' : 'text-[16px] sm:text-[22px] leading-none';
  const centerSuit = tiny
    ? 'text-[1.55rem] leading-none'
    : 'text-[2.15rem] sm:text-[3rem] leading-none';

  return (
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 48%, #f2f2f2 100%)',
      }}
    >
      {/* Soft horizontal sheen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[55%]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.55) 55%, transparent 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-[8%] top-[42%] h-px opacity-40"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.08), transparent)',
        }}
      />

      {/* Top-left: rank + small suit */}
      <div className={`absolute left-[5%] top-[5%] z-[1] flex flex-col items-center ${color}`}>
        <span className={`select-none font-extrabold tracking-tight ${rankClass}`}>{rank}</span>
      </div>

      {/* Top-right: medium suit */}
      {/* <div className={`absolute right-[6%] top-[6%] z-[1] ${color}`}>
        <span className={`select-none font-semibold ${topRightSuit}`}>{suit}</span>
      </div> */}

      {/* Large center suit */}
      <div className={`absolute inset-0 flex items-center justify-center ${color}`}>
        <span
          className={`select-none font-semibold ${centerSuit}`}
          style={{ transform: 'translateY(8%)' }}
        >
          {suit}
        </span>
      </div>
    </div>
  );
}

/** Mushroom back with brand hatch pattern and centered POKR logo. */
function CardBack({ size }: { size: CardSize }) {
  const tiny = isTiny(size);
  const micro = size === 'peek' || size === 'xs' || size === 'handSm';
  const inset = micro ? 'inset-[2px]' : tiny ? 'inset-[2.5px]' : 'inset-[3px]';
  const logoPad = micro ? 'p-[10%]' : tiny ? 'p-[12%]' : 'p-[14%]';

  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(155deg, #f0e6e4 0%, #e6d9d7 42%, #d9cac7 100%)',
      }}
    >
      {/* Inner rail + existing diagonal hatch (sidebar ink on mushroom stock) */}
      <div
        className={`absolute ${inset} rounded-[3px] border border-sidebar/20`}
        style={{
          backgroundImage: [
            'radial-gradient(ellipse at 50% 35%, rgba(29,4,50,0.08), transparent 55%)',
            'repeating-linear-gradient(45deg, rgba(29,4,50,0.1) 0 1px, transparent 1px 7px)',
            'repeating-linear-gradient(-45deg, rgba(29,4,50,0.07) 0 1px, transparent 1px 7px)',
          ].join(', '),
        }}
      />

      {/* Accent ring */}
      <div
        className={`pointer-events-none absolute ${inset} m-[6%] rounded-sm border border-sidebar/12`}
        aria-hidden
      />

      {/* POKR logo */}
      <div className={`absolute inset-0 flex items-center justify-center ${logoPad}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static public brand asset */}
        <img
          src="/purple-logo.png"
          alt=""
          width={80}
          height={40}
          className="h-full w-full max-h-full max-w-full object-contain object-center opacity-95 drop-shadow-[0_1px_2px_rgb(29_4_50/0.2)]"
          aria-hidden
          draggable={false}
        />
      </div>
    </div>
  );
}

function outerRadius(size: CardSize): string {
  if (size === 'xs' || size === 'peek' || size === 'board' || size === 'handSm') {
    return 'rounded-[0.2rem]';
  }
  if (size === 'hand' || size === 'md' || size === 'lg') {
    return 'rounded-[0.3rem] sm:rounded-[0.35rem]';
  }
  return 'rounded-[0.25rem] sm:rounded-[0.3rem]';
}

/**
 * Playing cards for board, opponents, and hole cards.
 * Faces use the classic modern style; backs keep the mushroom brand pattern.
 */
export function PlayingCard({
  code,
  faceDown = false,
  small = false,
  size,
  highlight = false,
  dimmed = false,
  dealDelay = 0,
  variant = 'deck',
}: {
  code?: string;
  faceDown?: boolean;
  /** @deprecated Prefer `size="sm"` */
  small?: boolean;
  size?: CardSize;
  highlight?: boolean;
  dimmed?: boolean;
  dealDelay?: number;
  variant?: 'deck' | 'hand';
}) {
  const resolved: CardSize =
    size ?? (variant === 'hand' ? 'hand' : small ? 'sm' : 'md');
  const w = SIZE[resolved];
  const radius = outerRadius(resolved);
  const winRing = highlight
    ? 'ring-2 ring-mushroom shadow-[0_0_20px_rgba(230,217,215,0.45)] scale-105 z-10'
    : 'ring-1 ring-black/40';
  const dim = dimmed && !highlight ? 'opacity-35 saturate-50' : '';
  const shell = [
    w,
    radius,
    'relative overflow-hidden',
    faceDown || !code ? 'bg-mushroom' : 'bg-white',
    'shadow-[0_4px_12px_rgba(0,0,0,0.35)]',
    winRing,
    dim,
    'transition-[opacity,transform,box-shadow] duration-300',
  ]
    .filter(Boolean)
    .join(' ');

  const isSmall =
    resolved === 'xs' ||
    resolved === 'sm' ||
    resolved === 'peek' ||
    resolved === 'board' ||
    resolved === 'hand' ||
    resolved === 'handSm';

  if (faceDown || !code) {
    return (
      <motion.div
        initial={
          isSmall
            ? { y: -14, opacity: 0, scale: 0.92, rotateZ: -3 }
            : { y: -28, opacity: 0, rotateZ: -6 }
        }
        animate={{ y: 0, opacity: 1, scale: 1, rotateZ: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 24, delay: dealDelay }}
        className={shell}
        aria-label="Facedown card"
      >
        <CardBack size={resolved} />
      </motion.div>
    );
  }

  const parsed = parseCode(code);
  if (!parsed) {
    return (
      <div className={`${shell} flex items-center justify-center text-xs text-ink/70`}>
        {code}
      </div>
    );
  }

  return (
    <motion.div
      initial={
        isSmall
          ? { y: -14, opacity: 0, scale: 0.92, rotateZ: -3 }
          : { y: -28, opacity: 0, rotateZ: -6 }
      }
      animate={{ y: 0, opacity: 1, scale: 1, rotateZ: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 24, delay: dealDelay }}
      className={shell}
      aria-label={code}
    >
      <CardFace rank={parsed.rank} suit={parsed.suit} red={parsed.red} size={resolved} />
      {highlight ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-mushroom to-transparent" />
      ) : null}
    </motion.div>
  );
}

export function HoleCardFan({
  cards,
  handId,
  winningCards,
  compact = false,
}: {
  cards: [string, string];
  handId?: string | null;
  winningCards?: Set<string> | null;
  compact?: boolean;
}) {
  const key = handId ?? 'hand';
  const cardSize = compact ? 'handSm' : 'hand';
  return (
    <div
      className={`relative z-[1] flex items-end justify-center ${
        compact
          ? 'mb-0.5 h-[3.25rem] w-[3.35rem]'
          : 'mb-1 h-[4.85rem] w-[4.4rem] sm:h-[6.4rem] sm:w-[5.6rem]'
      }`}
    >
      <div
        className="absolute left-1/2 origin-bottom drop-shadow-[0_6px_12px_rgba(14,6,24,0.4)]"
        style={{ bottom: 0, transform: 'translateX(-72%) rotate(-12deg)' }}
      >
        <PlayingCard
          key={`${key}-${cards[0]}`}
          code={cards[0]}
          variant="hand"
          size={cardSize}
          dealDelay={0}
          highlight={!!winningCards?.has(cards[0]!)}
          dimmed={!!winningCards && !winningCards.has(cards[0]!)}
        />
      </div>
      <div
        className="absolute left-1/2 origin-bottom drop-shadow-[0_6px_12px_rgba(14,6,24,0.4)]"
        style={{ bottom: 0, transform: 'translateX(-28%) rotate(10deg)', zIndex: 2 }}
      >
        <PlayingCard
          key={`${key}-${cards[1]}`}
          code={cards[1]}
          variant="hand"
          size={cardSize}
          dealDelay={0.08}
          highlight={!!winningCards?.has(cards[1]!)}
          dimmed={!!winningCards && !winningCards.has(cards[1]!)}
        />
      </div>
    </div>
  );
}
