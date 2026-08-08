/**
 * Shared Postgres pool. DATABASE_URL is required — no file/in-memory fallback.
 *
 * Render (and many PaaS hosts) only have outbound IPv4. Supabase direct hosts
 * (`db.<ref>.supabase.co`) are IPv6-only unless the paid IPv4 add-on is enabled.
 * We dial IPv4 when possible and rewrite Supabase URLs to the session pooler.
 */
import dns from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import { POSTGRES_DDL } from '@poker/db';

// Prefer A records over AAAA when both exist.
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

/** Guess AWS region from known public IPv6 prefixes (Supabase direct host AAAA). */
function regionFromIpv6(addr: string): string | null {
  const a = addr.toLowerCase();
  // https://docs.aws.amazon.com/vpc/latest/userguide/aws-ipv6-cidr-blocks.html (common)
  if (a.startsWith('2406:da14:') || a.startsWith('2406:da1c:')) return 'ap-southeast-1';
  if (a.startsWith('2406:da1a:')) return 'ap-south-1';
  if (a.startsWith('2406:da12:') || a.startsWith('2406:da16:')) return 'ap-northeast-1';
  if (a.startsWith('2406:da18:')) return 'ap-northeast-2';
  if (a.startsWith('2406:da1e:')) return 'ap-southeast-2';
  if (a.startsWith('2600:1f18:') || a.startsWith('2600:1f19:')) return 'us-east-1';
  if (a.startsWith('2600:1f10:') || a.startsWith('2600:1f11:')) return 'us-east-2';
  if (a.startsWith('2600:1f12:') || a.startsWith('2600:1f13:')) return 'us-west-1';
  if (a.startsWith('2600:1f14:') || a.startsWith('2600:1f15:')) return 'us-west-2';
  if (a.startsWith('2a05:d014:') || a.startsWith('2a05:d018:')) return 'eu-west-1';
  if (a.startsWith('2a05:d01c:') || a.startsWith('2a05:d01a:')) return 'eu-west-2';
  if (a.startsWith('2a05:d01e:')) return 'eu-central-1';
  if (a.startsWith('2a05:d012:')) return 'eu-north-1';
  if (a.startsWith('2600:1f1e:')) return 'sa-east-1';
  if (a.startsWith('2600:1f1c:')) return 'ca-central-1';
  return null;
}

/**
 * Convert IPv6-only Supabase direct URLs to the IPv4 session pooler.
 * Session mode (port 5432) suits a long-lived Node server.
 */
async function supabasePoolerUrl(connectionString: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(connectionString);
  } catch {
    return null;
  }
  const match = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(u.hostname);
  if (!match) return null;

  const projectRef = match[1]!;
  let region =
    process.env.SUPABASE_REGION?.trim() ||
    process.env.SUPABASE_DB_REGION?.trim() ||
    '';

  if (!region) {
    try {
      const { address } = await dnsLookup(u.hostname, { family: 6 });
      region = regionFromIpv6(address) ?? '';
    } catch {
      /* keep empty */
    }
  }
  if (!region) return null;

  const rawUser = decodeURIComponent(u.username || 'postgres');
  const user = rawUser.includes('.') ? rawUser : `postgres.${projectRef}`;
  const password = decodeURIComponent(u.password || '');
  const database = decodeURIComponent((u.pathname || '/').replace(/^\//, '') || 'postgres');
  // Session pooler — IPv4; transaction mode would be :6543
  const host = `aws-0-${region}.pooler.supabase.com`;
  const port = 5432;

  const next = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  console.log(`[db] Supabase direct host is IPv6-only; using session pooler ${host} (${region})`);
  return next;
}

function optionsFromUrl(connectionString: string, connectHost: string, servername?: string): PoolOptions {
  const u = new URL(connectionString);
  const database = decodeURIComponent((u.pathname || '/').replace(/^\//, '') || 'postgres');
  const options: PoolOptions = {
    connectionTimeoutMillis: 15_000,
    host: connectHost,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
  };
  if (needsSsl(servername ?? u.hostname, connectionString)) {
    options.ssl = {
      rejectUnauthorized: false,
      servername: servername ?? u.hostname,
    };
  }
  return options;
}

/**
 * Build pool options that dial IPv4 when possible.
 */
async function buildPoolOptions(connectionString: string): Promise<PoolOptions> {
  let url = connectionString;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { connectionString: url, connectionTimeoutMillis: 15_000 };
  }

  // Prefer IPv4 to the configured host.
  try {
    const { address } = await dnsLookup(hostname, { family: 4 });
    console.log(`[db] connecting via IPv4 ${address} (${hostname})`);
    return optionsFromUrl(url, address, hostname);
  } catch {
    /* no A record */
  }

  // Local / dual-stack hosts can reach Supabase direct over IPv6. Prefer that before
  // rewriting to the session pooler (which needs the correct region + pooler user).
  try {
    const { address } = await dnsLookup(hostname, { family: 6 });
    console.log(`[db] connecting via IPv6 ${address} (${hostname})`);
    return optionsFromUrl(url, address, hostname);
  } catch {
    /* no AAAA record */
  }

  // Supabase direct (`db.<ref>.supabase.co`) → session pooler over IPv4.
  const pooler = await supabasePoolerUrl(url);
  if (pooler) {
    url = pooler;
    hostname = new URL(url).hostname;
    try {
      const { address } = await dnsLookup(hostname, { family: 4 });
      console.log(`[db] connecting via IPv4 ${address} (${hostname})`);
      return optionsFromUrl(url, address, hostname);
    } catch {
      return optionsFromUrl(url, hostname);
    }
  }

  if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(hostname)) {
    throw new Error(
      'Supabase direct host is IPv6-only and this host has no IPv6 route. ' +
        'Set DATABASE_URL to the Session pooler URI from Supabase → Connect ' +
        '(aws-0-<region>.pooler.supabase.com:5432, user postgres.<project-ref>), ' +
        'or set SUPABASE_REGION (e.g. ap-southeast-1).',
    );
  }

  console.log(`[db] IPv4 lookup failed for ${hostname}; using hostname as-is`);
  const options: PoolOptions = { connectionString: url, connectionTimeoutMillis: 15_000 };
  if (needsSsl(hostname, url)) {
    options.ssl = { rejectUnauthorized: false };
  }
  return options;
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
