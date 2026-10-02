import { describe, expect, it } from 'vitest';
import { normalizeQueryResult } from './queryable.js';

describe('normalizeQueryResult', () => {
  it('passes SELECT / INSERT rows through', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(normalizeQueryResult(rows)).toEqual({ rows, rowCount: 2 });
  });

  it('unwraps TypeORM UPDATE/DELETE ... RETURNING tuples', () => {
    expect(normalizeQueryResult([[{ user_id: 'u1', email: 'a@b.co' }], 1])).toEqual({
      rows: [{ user_id: 'u1', email: 'a@b.co' }],
      rowCount: 1,
    });
  });

  it('treats an UPDATE that matched nothing as no rows', () => {
    expect(normalizeQueryResult([[], 0])).toEqual({ rows: [], rowCount: 0 });
  });

  it('handles non-array results', () => {
    expect(normalizeQueryResult(undefined)).toEqual({ rows: [], rowCount: 0 });
  });
});
