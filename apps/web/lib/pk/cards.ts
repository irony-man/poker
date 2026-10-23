const RANK_WORD: Record<string, string> = {
  A: 'ace',
  K: 'king',
  Q: 'queen',
  J: 'jack',
  T: 'ten',
  '10': 'ten',
  '9': 'nine',
  '8': 'eight',
  '7': 'seven',
  '6': 'six',
  '5': 'five',
  '4': 'four',
  '3': 'three',
  '2': 'two',
};

const SUIT_WORD: Record<string, string> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
};

/** "Ah" → "ace of hearts". Unknown codes stay as the raw text. */
export function cardLabel(code: string): string {
  const raw = code.trim();
  if (raw.length < 2) return raw;
  const suit = raw.slice(-1);
  const rank = raw.slice(0, -1);
  const rankWord = RANK_WORD[rank] ?? RANK_WORD[rank.toUpperCase()];
  const suitWord = SUIT_WORD[suit];
  if (!rankWord || !suitWord) return raw;
  return `${rankWord} of ${suitWord}`;
}
