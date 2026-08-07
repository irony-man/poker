/**
 * Shared Postgres pool for local/production when DATABASE_URL is set.
 */
import { POSTGRES_DDL } from '@poker/db';

export type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;
  end: () => Promise<void>;
};

type PoolOptions = {
  connectionString: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  connectionTimeoutMillis?: number;
};

let sharedPool: PgPool | null = null;

export function getPool(): PgPool | null {
  return sharedPool;
}

function needsSsl(connectionString: string): boolean {
  try {
    const u = new URL(connectionString);
    const host = u.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === 'postgres') return false;
    // Prefer explicit sslmode; many hosted DBs (Supabase) need TLS.
    if (u.searchParams.get('sslmode') === 'disable') return false;
    return true;
  } catch {
    return true;
  }
}

export async function initDatabase(): Promise<PgPool | null> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log('[db] DATABASE_URL unset — using file/in-memory stores');
    return null;
  }

  try {
    const mod = (await import('pg')) as unknown as {
      default?: {
        Pool?: new (o: PoolOptions) => PgPool;
      };
      Pool?: new (o: PoolOptions) => PgPool;
    };
    const PoolCtor = mod.Pool ?? mod.default?.Pool;
    if (!PoolCtor) {
      console.warn('[db] pg.Pool not found — is the pg package installed?');
      return null;
    }

    const options: PoolOptions = {
      connectionString: url,
      connectionTimeoutMillis: 15_000,
    };
    if (needsSsl(url)) {
      options.ssl = { rejectUnauthorized: false };
    }

    const pool = new PoolCtor(options);
    await pool.query('SELECT 1');
    await pool.query(POSTGRES_DDL);
    // Ensure additive columns on older installs that already have bare users table.
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username_lower TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id INT NOT NULL DEFAULT 0;
    `);
    sharedPool = pool;
    console.log('[db] Postgres connected and schema ready');
    return pool;
  } catch (err) {
    console.error('[db] Postgres unavailable:', err);
    sharedPool = null;
    return null;
  }
}
