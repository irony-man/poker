/**
 * Shared Postgres pool. DATABASE_URL is required — no file/in-memory fallback.
 */
import dns from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import { POSTGRES_DDL } from '@poker/db';

// Render (and many PaaS hosts) lack outbound IPv6; prefer A records over AAAA.
dns.setDefaultResultOrder('ipv4first');

export type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;
  end: () => Promise<void>;
};

type PoolOptions = {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean | { rejectUnauthorized: boolean; servername?: string };
  connectionTimeoutMillis?: number;
};

let sharedPool: PgPool | null = null;

export function getPool(): PgPool | null {
  return sharedPool;
}

function needsSsl(hostname: string, connectionString: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === 'postgres') return false;
  try {
    const u = new URL(connectionString);
    if (u.searchParams.get('sslmode') === 'disable') return false;
  } catch {
    /* ignore */
  }
  return true;
}

/**
 * Build pool options that dial IPv4 when possible.
 * DNS AAAA-first resolution causes ENETUNREACH on IPv4-only hosts (e.g. Render free).
 */
async function buildPoolOptions(connectionString: string): Promise<PoolOptions> {
  const base: PoolOptions = { connectionTimeoutMillis: 15_000 };
  let hostname: string;
  try {
    const u = new URL(connectionString);
    hostname = u.hostname;
  } catch {
    return { ...base, connectionString };
  }

  const useSsl = needsSsl(hostname, connectionString);

  try {
    const { address } = await dnsLookup(hostname, { family: 4 });
    const u = new URL(connectionString);
    const database = decodeURIComponent((u.pathname || '/').replace(/^\//, '') || 'postgres');
    const options: PoolOptions = {
      ...base,
      host: address,
      port: Number(u.port || 5432),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database,
    };
    if (useSsl) {
      // SNI must use the original hostname when dialing by IP.
      options.ssl = { rejectUnauthorized: false, servername: hostname };
    }
    console.log(`[db] connecting via IPv4 ${address} (${hostname})`);
    return options;
  } catch {
    // No A record — fall back to the URL (may still fail on IPv6-only).
    const options: PoolOptions = { ...base, connectionString };
    if (useSsl) {
      options.ssl = { rejectUnauthorized: false };
    }
    console.log(`[db] IPv4 lookup failed for ${hostname}; using connection string as-is`);
    return options;
  }
}

export async function initDatabase(): Promise<PgPool> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is required');
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
      throw new Error('pg.Pool not found — is the pg package installed?');
    }

    const options = await buildPoolOptions(url);
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
    sharedPool = null;
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Postgres unavailable: ${message}`, { cause: err });
  }
}
