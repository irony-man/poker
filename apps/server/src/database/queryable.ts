/**
 * Adapt TypeORM DataSource to the pg-like { rows } query shape used by domain stores.
 */
import type { DataSource } from 'typeorm';

export type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;
};

export function dataSourceAsQueryable(ds: DataSource): Queryable {
  return {
    async query(text: string, params?: unknown[]) {
      const rows = (await ds.query(text, params)) as unknown[];
      return { rows: Array.isArray(rows) ? rows : [], rowCount: Array.isArray(rows) ? rows.length : 0 };
    },
  };
}
