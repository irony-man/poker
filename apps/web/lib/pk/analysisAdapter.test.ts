import { describe, expect, it } from 'vitest';
import type { MyHandRow } from '@/lib/api';
import { adaptHandsToTables, filterTables } from './analysisAdapter';

const rows: MyHandRow[] = [
  {
    id: '1',
    tableId: 't1',
    handId: 'h1',
    contestId: null,
    source: 'online',
    startedAt: '2026-01-01T00:00:00.000Z',
    endedAt: null,
    resultJson: { winners: [{ userId: 'me', amount: 20 }], players: [{ userId: 'me' }, { userId: 'bot:a' }] },
  },
  {
    id: '2',
    tableId: 't1',
    handId: 'h2',
    contestId: null,
    source: 'online',
    startedAt: '2026-01-02T00:00:00.000Z',
    endedAt: null,
    resultJson: {},
  },
];

describe('analysis adapter', () => {
  it('groups /api/me/hands rows by table', () => {
    const tables = adaptHandsToTables(rows, 'me');
    expect(tables).toHaveLength(1);
    expect(tables[0]?.hands).toBe(2);
    expect(tables[0]?.handIds).toEqual(['h1', 'h2']);
    expect(filterTables(tables, 'bots')).toEqual([]);
    expect(filterTables(tables, 'players')).toHaveLength(1);
  });
});
