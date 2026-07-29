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

/** Standard pip centers as % of the face (x, y). */
const PIP_LAYOUT: Record<string, Array<[number, number]>> = {
  A: [[50, 52]],
  '2': [
    [50, 22],
    [50, 78],
  ],
  '3': [
    [50, 22],
    [50, 50],
    [50, 78],
  ],
  '4': [
    [32, 24],
    [68, 24],
    [32, 76],
    [68, 76],
  ],
  '5': [
    [32, 24],
    [68, 24],
    [50, 50],
    [32, 76],
    [68, 76],
  ],
  '6': [
    [32, 24],
    [68, 24],
    [32, 50],
    [68, 50],
    [32, 76],
    [68, 76],
  ],
  '7': [
    [32, 22],
    [68, 22],
    [50, 36],
    [32, 50],
    [68, 50],
    [32, 78],
    [68, 78],
  ],
  '8': [
    [32, 20],
    [68, 20],
    [50, 34],
    [32, 50],
    [68, 50],
    [50, 66],
    [32, 80],
    [68, 80],
  ],
  '9': [
    [32, 18],
    [68, 18],
    [32, 36],
    [68, 36],
    [50, 50],
    [32, 64],
    [68, 64],
    [32, 82],
    [68, 82],
  ],
  T: [
    [32, 16],
    [68, 16],
    [50, 28],
    [32, 38],
    [68, 38],
    [32, 62],
    [68, 62],
    [50, 72],
    [32, 84],
    [68, 84],
  ],
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

/** Glossy white face with oversized center suit — in-hand style. */
function HandFace({
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
  return (
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(160deg, #ffffff 0%, #f7f7f7 55%, #ececec 100%)',
      }}
    >
      <div className={`absolute inset-0 flex items-center justify-center ${color}`}>
        <span
          className={`select-none font-semibold leading-none ${
            tiny ? 'text-[1.65rem]' : 'text-[2.35rem] sm:text-[3.1rem]'
          }`}
          style={{ transform: 'translateY(6%)' }}
        >
          {suit}
        </span>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[52%]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 70%, transparent 100%)',
          clipPath: 'ellipse(120% 100% at 50% 0%)',
        }}
      />
      <div className={`absolute left-[3px] top-[3px] z-[1] flex flex-col items-center leading-none ${color}`}>
        <span
          className={`font-extrabold tracking-tight ${tiny ? 'text-[10px]' : 'text-[14px] sm:text-[17px]'}`}
        >
          {rank}
        </span>
        <span className={`-mt-0.5 ${tiny ? 'text-[9px]' : 'text-[12px] sm:text-[14px]'}`}>{suit}</span>
      </div>
    </div>
  );
}

/** Classic pip / court face for board & opponents. */
function DeckFace({
  rankChar,
  rank,
  suit,
  red,
  size,
}: {
  rankChar: string;
  rank: string;
  suit: string;
  red: boolean;
  size: CardSize;
}) {
  const color = red ? 'text-[#c62828]' : 'text-[#1a1a1a]';
  const tiny = isTiny(size);
  const pips = PIP_LAYOUT[rankChar];
  const pipSize = tiny
    ? rankChar === 'A'
      ? 'text-[1.15rem]'
      : 'text-[0.55rem] sm:text-[0.7rem]'
    : rankChar === 'A'
      ? 'text-[1.85rem] sm:text-[2.6rem]'
      : 'text-[0.7rem] sm:text-[1rem]';
  const cornerRank = tiny ? 'text-[9px] sm:text-[11px]' : 'text-[11px] sm:text-sm';
  const cornerSuit = tiny ? 'text-[8px] sm:text-[10px]' : 'text-[10px] sm:text-xs';

  return (
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(165deg, #fffef9 0%, #f4efe4 55%, #ebe4d6 100%)',
      }}
    >
      <div className={`absolute left-[2px] top-[2px] z-[1] flex flex-col items-center leading-none ${color}`}>
        <span className={`font-extrabold tracking-tight ${cornerRank}`}>{rank}</span>
        <span className={`-mt-px ${cornerSuit}`}>{suit}</span>
      </div>
      <div
        className={`absolute bottom-[2px] right-[2px] z-[1] flex rotate-180 flex-col items-center leading-none ${color}`}
      >
        <span className={`font-extrabold tracking-tight ${cornerRank}`}>{rank}</span>
        <span className={`-mt-px ${cornerSuit}`}>{suit}</span>
      </div>

      {pips ? (
        <div className={`absolute inset-0 ${color}`}>
          {pips.map(([x, y], i) => (
            <span
              key={i}
              className={`absolute -translate-x-1/2 -translate-y-1/2 select-none font-semibold leading-none ${pipSize} ${
                y > 55 ? 'rotate-180' : ''
              }`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {suit}
            </span>
          ))}
        </div>
      ) : (
        <div className={`absolute inset-0 flex flex-col items-center justify-center ${color}`}>
          <span
            className={`select-none font-extrabold leading-none ${
              tiny ? 'text-base' : 'text-xl sm:text-3xl'
            }`}
          >
            {rank}
          </span>
          <span
            className={`select-none leading-none ${tiny ? 'text-sm' : 'text-lg sm:text-2xl'}`}
          >
            {suit}
          </span>
        </div>
      )}
    </div>
  );
}

function CardBack({ size }: { size: CardSize }) {
  const tiny = isTiny(size);
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(145deg, #1a3d6e 0%, #0f2748 45%, #0a1a32 100%)',
      }}
    >
      <div
        className="absolute inset-[3px] rounded-[2px] border border-[#c9a227]/55"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(201,162,39,0.18) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgba(201,162,39,0.12) 0 2px, transparent 2px 6px)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`select-none font-display font-bold tracking-wider text-[#e0b43a]/90 ${
            tiny ? 'text-[8px]' : 'text-[10px] sm:text-xs'
          }`}
        >
          FELT
        </span>
      </div>
    </div>
  );
}

/**
 * `deck` — classic CSS faces for board / opponents.
 * `hand` — glossy large-suit faces for the hero’s hole cards.
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
  const radius =
    variant === 'hand'
      ? resolved === 'handSm' || resolved === 'peek'
        ? 'rounded-lg'
        : 'rounded-xl'
      : resolved === 'xs' || resolved === 'sm' || resolved === 'peek' || resolved === 'board'
        ? 'rounded-[4px]'
        : 'rounded-md sm:rounded-lg';
  const winRing = highlight
    ? 'ring-2 ring-gold shadow-[0_0_18px_rgba(232,185,74,0.55)] scale-105 z-10'
    : variant === 'hand'
      ? 'ring-[1.5px] ring-black/50'
      : 'ring-1 ring-black/30';
  const dim = dimmed && !highlight ? 'opacity-35 saturate-50' : '';
  const shell = [
    w,
    radius,
    'relative overflow-hidden bg-white',
    variant === 'hand'
      ? 'shadow-[0_6px_16px_rgba(0,0,0,0.55)]'
      : 'shadow-md',
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
      {variant === 'hand' ? (
        <HandFace rank={parsed.rank} suit={parsed.suit} red={parsed.red} size={resolved} />
      ) : (
        <DeckFace
          rankChar={parsed.rankChar}
          rank={parsed.rank}
          suit={parsed.suit}
          red={parsed.red}
          size={resolved}
        />
      )}
      {highlight ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-gold to-transparent" />
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
        compact ? 'mb-0.5 h-[3.25rem] w-[3.35rem]' : 'mb-1 h-[4.85rem] w-[4.4rem] sm:h-[6.4rem] sm:w-[5.6rem]'
      }`}
    >
      <div
        className="absolute left-1/2 origin-bottom drop-shadow-lg"
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
        className="absolute left-1/2 origin-bottom drop-shadow-lg"
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
