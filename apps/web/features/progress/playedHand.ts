import type { MyHandRow } from '@/lib/api';

const RANK_CHAR: Record<number, string> = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
  10: 'T',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

export function cardCode(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.length >= 2) return raw;
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as { rank?: unknown; suit?: unknown };
  const suit = typeof rec.suit === 'string' ? rec.suit : null;
  if (!suit) return null;
  if (typeof rec.rank === 'number' && RANK_CHAR[rec.rank]) {
    return `${RANK_CHAR[rec.rank]}${suit}`;
  }
  if (typeof rec.rank === 'string') return `${rec.rank}${suit}`;
  return null;
}

export function cardCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(cardCode).filter((c): c is string => !!c);
}

export type PlayedHandLevel = {
  id: string;
  handId: string;
  source: string;
  startedAt: number;
  holeCards: [string, string] | null;
  community: string[];
  won: boolean;
  winnerName: string | null;
  handName: string | null;
};

function parseResult(resultJson: unknown): Record<string, unknown> | null {
  if (resultJson && typeof resultJson === 'object') {
    return resultJson as Record<string, unknown>;
  }
  if (typeof resultJson !== 'string') return null;
  try {
    const parsed = JSON.parse(resultJson) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function startedAtMs(raw: string | number | Date | null | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string') {
    const n = Date.parse(raw);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export function parsePlayedHand(row: MyHandRow, userId: string): PlayedHandLevel {
  const result = parseResult(row.resultJson);
  const players = Array.isArray(result?.players) ? result.players : [];
  let seat: number | null = null;
  let hole: string[] = [];
  for (const p of players) {
    if (!p || typeof p !== 'object') continue;
    const rec = p as { userId?: unknown; seat?: unknown; holeCards?: unknown; name?: unknown };
    if (rec.userId !== userId) continue;
    if (typeof rec.seat === 'number') seat = rec.seat;
    hole = cardCodes(rec.holeCards);
    break;
  }
  const winnersRaw = Array.isArray(result?.winners) ? result.winners : [];
  let won = false;
  let winnerName: string | null = null;
  let handName: string | null = null;
  for (const w of winnersRaw) {
    if (!w || typeof w !== 'object') continue;
    const rec = w as { seat?: unknown; name?: unknown; handName?: unknown };
    if (typeof rec.seat === 'number' && rec.seat === seat) {
      won = true;
      handName = typeof rec.handName === 'string' ? rec.handName : null;
    }
    if (!winnerName && typeof rec.name === 'string' && rec.name) winnerName = rec.name;
  }
  const pair: [string, string] | null = hole.length >= 2 ? [hole[0]!, hole[1]!] : null;
  return {
    id: row.id,
    handId: row.handId,
    source: row.source ?? 'online',
    startedAt: startedAtMs(row.startedAt),
    holeCards: pair,
    community: cardCodes(result?.community),
    won,
    winnerName,
    handName,
  };
}

/** Newest fetched hand maps to `handsPlayed`, then count backward. */
export function handsByLevel(
  hands: PlayedHandLevel[],
  handsPlayed: number,
): Map<number, PlayedHandLevel> {
  const map = new Map<number, PlayedHandLevel>();
  hands.forEach((hand, i) => {
    const level = handsPlayed - i;
    if (level >= 1) map.set(level, hand);
  });
  return map;
}

export function formatHandWhen(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
