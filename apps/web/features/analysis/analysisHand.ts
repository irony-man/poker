import { handOpponents, type HandResultPayload, type StreetActionKind } from '@poker/engine';
import type { AnalysisTableRow, MyHandRow } from '@/lib/api';
import { parsePlayedHand, type PlayedHandLevel } from '@/features/progress/playedHand';

export type AnalysisFilter = 'all' | 'bots' | 'players';

export type AnalysisHandRow = {
  row: MyHandRow;
  played: PlayedHandLevel;
  result: HandResultPayload;
  vsBots: boolean;
};

function parseResult(raw: unknown): HandResultPayload {
  let value: unknown = raw;
  for (let i = 0; i < 2 && typeof value === 'string'; i += 1) {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? (value as HandResultPayload) : {};
}

export function toAnalysisRow(row: MyHandRow, userId: string): AnalysisHandRow {
  const result = parseResult(row.resultJson);
  const vsBots = handOpponents(result, userId, row.source) === 'bots';
  return { row, played: parsePlayedHand(row, userId), result, vsBots };
}

/** A table can straddle two pages when its hands interleave with another table's. */
export function mergeTables(prev: AnalysisTableRow[], next: AnalysisTableRow[]): AnalysisTableRow[] {
  const out = prev.map((t) => ({ ...t, players: [...(t.players ?? [])] }));
  for (const t of next) {
    const existing = out.find((o) => o.tableId === t.tableId);
    if (!existing) {
      out.push({ ...t, players: [...(t.players ?? [])] });
      continue;
    }
    for (const p of t.players ?? []) {
      if (!existing.players.some((x) => x.userId === p.userId)) existing.players.push(p);
    }
    existing.hands += t.hands;
    existing.handsWon += t.handsWon;
    existing.firstAt = Math.min(existing.firstAt, t.firstAt);
    existing.lastAt = Math.max(existing.lastAt, t.lastAt);
    if (t.opponents === 'players') existing.opponents = 'players';
    if (t.coached) existing.coached = true;
  }
  return out;
}

/** "You vs Ana, Ben & Cat", or the first `max` names plus a count of the rest. */
export function playersHeadingParts(
  names: string[],
  max = 4,
): { text: string; more: number } {
  const shown = names.slice(0, max);
  const more = names.length - shown.length;
  if (more > 0) return { text: `You vs ${shown.join(', ')}`, more };
  if (shown.length <= 1) return { text: `You vs ${shown[0] ?? 'others'}`, more: 0 };
  return { text: `You vs ${shown.slice(0, -1).join(', ')} & ${shown[shown.length - 1]}`, more: 0 };
}

export function playersHeading(names: string[], max = 4): string {
  const { text, more } = playersHeadingParts(names, max);
  return more > 0 ? `${text} +${more} more` : text;
}

export function analysisTableHref(tableId: string, coach = false): string {
  const path = `/analysis/${encodeURIComponent(tableId)}`;
  return coach ? `${path}?coach=1` : path;
}

export function tableLabel(table: Pick<AnalysisTableRow, 'source' | 'opponents'>): string {
  if (table.source === 'offline') return 'Offline vs bots';
  return table.opponents === 'bots' ? 'Table vs bots' : 'Table with players';
}

export const ACTION_LABEL: Record<StreetActionKind, string> = {
  small_blind: 'posts small blind',
  big_blind: 'posts big blind',
  fold: 'folds',
  check: 'checks',
  call: 'calls',
  bet: 'bets',
  raise: 'raises to',
  allin: 'goes all-in',
};

/** Same actions phrased for "You". */
export const ACTION_LABEL_YOU: Record<StreetActionKind, string> = {
  small_blind: 'post small blind',
  big_blind: 'post big blind',
  fold: 'fold',
  check: 'check',
  call: 'call',
  bet: 'bet',
  raise: 'raise to',
  allin: 'go all-in',
};

export const STREET_LABEL = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
} as const;
