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

export type ShownPlayerHand = {
  userId: string;
  name: string;
  holeCards: [string, string] | null;
  isViewer: boolean;
  isWinner: boolean;
};

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
  /** Viewer + anyone whose hole cards were revealed at showdown. */
  shownPlayers: ShownPlayerHand[];
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
  const nameBySeat = new Map<number, string>();
  const playerBySeat = new Map<
    number,
    { userId: string; name: string; holeCards: string[]; revealed: boolean }
  >();

  let seat: number | null = null;
  let hole: string[] = [];
  for (const p of players) {
    if (!p || typeof p !== 'object') continue;
    const rec = p as {
      userId?: unknown;
      seat?: unknown;
      holeCards?: unknown;
      name?: unknown;
      revealed?: unknown;
    };
    const pid = typeof rec.userId === 'string' ? rec.userId : '';
    const pname =
      typeof rec.name === 'string' && rec.name
        ? rec.name
        : pid
          ? pid
          : 'Player';
    const cards = cardCodes(rec.holeCards);
    if (typeof rec.seat === 'number') {
      nameBySeat.set(rec.seat, pname);
      playerBySeat.set(rec.seat, {
        userId: pid,
        name: pname,
        holeCards: cards,
        revealed: rec.revealed === true,
      });
    }
    if (pid === userId) {
      if (typeof rec.seat === 'number') seat = rec.seat;
      hole = cards;
    }
  }

  const winnersRaw = Array.isArray(result?.winners) ? result.winners : [];
  let won = false;
  let handName: string | null = null;
  const winnerNames: string[] = [];
  const winnerSeats = new Set<number>();
  for (const w of winnersRaw) {
    if (!w || typeof w !== 'object') continue;
    const rec = w as { seat?: unknown; name?: unknown; handName?: unknown };
    if (typeof rec.seat !== 'number') continue;
    winnerSeats.add(rec.seat);
    const resolved =
      (typeof rec.name === 'string' && rec.name) || nameBySeat.get(rec.seat) || null;
    if (resolved && !winnerNames.includes(resolved)) winnerNames.push(resolved);
    if (!handName && typeof rec.handName === 'string' && rec.handName) {
      handName = rec.handName;
    }
    if (rec.seat === seat) won = true;
  }
  const winnerName = winnerNames.length > 0 ? winnerNames.join(' & ') : null;
  const pair: [string, string] | null = hole.length >= 2 ? [hole[0]!, hole[1]!] : null;

  const shownPlayers: ShownPlayerHand[] = [];
  const seen = new Set<string>();
  for (const [seatNum, p] of playerBySeat) {
    const isViewer = p.userId === userId;
    const hasCards = p.holeCards.length >= 2;
    // Viewer always; others only when hole cards survived redaction (revealed at showdown).
    if (!isViewer && !hasCards) continue;
    const key = p.userId || `${seatNum}:${p.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    shownPlayers.push({
      userId: p.userId,
      name: p.name,
      holeCards: hasCards ? [p.holeCards[0]!, p.holeCards[1]!] : isViewer ? pair : null,
      isViewer,
      isWinner: winnerSeats.has(seatNum),
    });
  }
  // Viewer first, then winners, then others by name.
  shownPlayers.sort((a, b) => {
    if (a.isViewer !== b.isViewer) return a.isViewer ? -1 : 1;
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

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
    shownPlayers,
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
