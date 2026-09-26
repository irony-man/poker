import type { SuitKey } from '@/lib/cardFaceTheme';

export const RANK_DISPLAY: Record<string, string> = {
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

/** Text-style suits (VS15) so CSS color applies. */
export const SUIT_GLYPH: Record<SuitKey, string> = {
  h: '♥\uFE0E',
  d: '♦\uFE0E',
  c: '♣\uFE0E',
  s: '♠\uFE0E',
};

export const SUIT_LABEL: Record<SuitKey, string> = {
  h: 'Hearts',
  d: 'Diamonds',
  c: 'Clubs',
  s: 'Spades',
};

/** Split engine (`Th`) or preview (`10d`, `Ah`) codes. */
export function parseCardPreviewCode(code: string): {
  rank: string;
  suitGlyph: string;
  suitKey: SuitKey;
  /** Two-char engine code for ink / storage. */
  engineCode: string;
} {
  const trimmed = code.trim();
  const fallback = {
    rank: '?',
    suitGlyph: SUIT_GLYPH.s,
    suitKey: 's' as SuitKey,
    engineCode: 'As',
  };
  if (trimmed.length < 2) return fallback;

  const suitChar = trimmed.slice(-1).toLowerCase();
  if (!(suitChar in SUIT_GLYPH)) return fallback;
  const suitKey = suitChar as SuitKey;

  let rankRaw = trimmed.slice(0, -1).toUpperCase();
  if (rankRaw === '10') rankRaw = 'T';
  if (rankRaw.length !== 1) return fallback;

  const rank = RANK_DISPLAY[rankRaw] ?? rankRaw;
  return {
    rank,
    suitGlyph: SUIT_GLYPH[suitKey],
    suitKey,
    engineCode: `${rankRaw}${suitChar}`,
  };
}
