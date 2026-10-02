/**
 * Adapt TypeORM DataSource to the pg-like { rows } query shape used by domain stores.
 */
import type { DataSource } from 'typeorm';

export type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;
};

/**
 * TypeORM's Postgres `query()` returns plain rows for SELECT/INSERT, but `[rows, affectedCount]`
 * for UPDATE/DELETE (including `... RETURNING`). Rows are always objects, so that tuple is unambiguous.
 */
export function normalizeQueryResult(raw: unknown): { rows: unknown[]; rowCount: number } {
  if (
    Array.isArray(raw) &&
    raw.length === 2 &&
    Array.isArray(raw[0]) &&
    typeof raw[1] === 'number'
  ) {
    return { rows: raw[0], rowCount: raw[1] };
  }
  const rows = Array.isArray(raw) ? raw : [];
  return { rows, rowCount: rows.length };
}

export function dataSourceAsQueryable(ds: DataSource): Queryable {
  return {
    async query(text: string, params?: unknown[]) {
      return normalizeQueryResult(await ds.query(text, params));
    },
  };
}
