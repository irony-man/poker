import type { MyHandRow, AnalysisTableRow } from '@/lib/api';
import { tableLabel, toAnalysisRow, type AnalysisHandRow } from '@/features/analysis/analysisHand';

export type AdaptedTable = {
  tableId: string;
  source: string;
  opponents: 'bots' | 'players';
  hands: number;
  handsWon: number;
  firstAt: number;
  lastAt: number;
  label: string;
  handIds: string[];
};

/** Group `GET /api/me/hands` rows into the table cards the analysis frames show. */
export function adaptHandsToTables(rows: MyHandRow[], userId: string): AdaptedTable[] {
  const byTable = new Map<string, AdaptedTable>();
  for (const row of rows) {
    const hand = toAnalysisRow(row, userId);
    const existing = byTable.get(row.tableId);
    const at = hand.played.startedAt || Date.parse(row.startedAt) || 0;
    if (!existing) {
      const opponents = hand.vsBots ? 'bots' : 'players';
      byTable.set(row.tableId, {
        tableId: row.tableId,
        source: row.source,
        opponents,
        hands: 1,
        handsWon: hand.played.won ? 1 : 0,
        firstAt: at,
        lastAt: at,
        label: tableLabel({ source: row.source, opponents }),
        handIds: [row.handId],
      });
      continue;
    }
    existing.hands += 1;
    if (hand.played.won) existing.handsWon += 1;
    existing.firstAt = Math.min(existing.firstAt, at);
    existing.lastAt = Math.max(existing.lastAt, at);
    if (!hand.vsBots) {
      existing.opponents = 'players';
      existing.label = tableLabel({ source: existing.source, opponents: 'players' });
    }
    existing.handIds.push(row.handId);
  }
  return [...byTable.values()].sort((a, b) => b.lastAt - a.lastAt);
}

export function adaptHandRows(rows: MyHandRow[], userId: string): AnalysisHandRow[] {
  return rows.map((row) => toAnalysisRow(row, userId));
}

/** Fields the current tables endpoint already returns. Streets beyond community cards stay hidden. */
export function tableCardFromApi(table: AnalysisTableRow): AdaptedTable {
  return {
    tableId: table.tableId,
    source: table.source,
    opponents: table.opponents,
    hands: table.hands,
    handsWon: table.handsWon,
    firstAt: table.firstAt,
    lastAt: table.lastAt,
    label: tableLabel(table),
    handIds: [],
  };
}

export function filterTables(tables: AdaptedTable[], opponents: 'all' | 'players' | 'bots'): AdaptedTable[] {
  if (opponents === 'all') return tables;
  return tables.filter((table) => table.opponents === opponents);
}
