/**
 * Build TypeORM DataSource options from DATABASE_URL.
 * Keeps Supabase / IPv4-first connection logic used by the previous pg Pool code.
 */
import dns from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import type { DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from './entities.js';

dns.setDefaultResultOrder('ipv4first');

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

function regionFromIpv6(addr: string): string | null {
  const a = addr.toLowerCase();
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
  const host = `aws-0-${region}.pooler.supabase.com`;
  const port = 5432;

  console.log(`[db] Supabase direct host is IPv6-only; using session pooler ${host} (${region})`);
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export type ResolvedDbConnection = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl?: boolean | { rejectUnauthorized: boolean; servername?: string };
  /** Hostname for TLS SNI when dialling by IP. */
  servername?: string;
};

function connectionParts(
  connectionString: string,
  connectHost: string,
  servername?: string,
): ResolvedDbConnection {
  const u = new URL(connectionString);
  const database = decodeURIComponent((u.pathname || '/').replace(/^\//, '') || 'postgres');
  const parts: ResolvedDbConnection = {
    host: connectHost,
    port: Number(u.port || 5432),
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
  };
  if (needsSsl(servername ?? u.hostname, connectionString)) {
    parts.ssl = {
      rejectUnauthorized: false,
      servername: servername ?? u.hostname,
    };
    parts.servername = servername ?? u.hostname;
  }
  return parts;
}

/**
 * Resolve DATABASE_URL into host/user/ssl options (IPv4-first, Supabase pooler rewrite).
 */
export async function resolveDatabaseConnection(
  connectionString: string,
): Promise<ResolvedDbConnection | { url: string; ssl?: { rejectUnauthorized: boolean } }> {
  let url = connectionString;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { url };
  }

  const isSupabaseDirect = /^db\.[a-z0-9]+\.supabase\.co$/i.test(hostname);

  try {
    const { address } = await dnsLookup(hostname, { family: 4 });
    console.log(`[db] connecting via IPv4 ${address} (${hostname})`);
    return connectionParts(url, address, hostname);
  } catch {
    /* no A record */
  }

  if (isSupabaseDirect) {
    const pooler = await supabasePoolerUrl(url);
    if (pooler) {
      url = pooler;
      hostname = new URL(url).hostname;
      try {
        const { address } = await dnsLookup(hostname, { family: 4 });
        console.log(`[db] connecting via IPv4 ${address} (${hostname})`);
        return connectionParts(url, address, hostname);
      } catch {
        console.log(`[db] connecting to pooler hostname ${hostname}`);
        return connectionParts(url, hostname);
      }
    }
    throw new Error(
      'Supabase direct host is IPv6-only and this host has no IPv6 route. ' +
        'Set DATABASE_URL to the Session pooler URI from Supabase → Connect ' +
        '(aws-0-<region>.pooler.supabase.com:5432, user postgres.<project-ref>), ' +
        'or set SUPABASE_REGION (e.g. ap-southeast-1).',
    );
  }

  try {
    const { address } = await dnsLookup(hostname, { family: 6 });
    console.log(`[db] connecting via IPv6 ${address} (${hostname})`);
    return connectionParts(url, address, hostname);
  } catch {
    /* no AAAA */
  }

  console.log(`[db] IPv4 lookup failed for ${hostname}; using hostname as-is`);
  const fallback: { url: string; ssl?: { rejectUnauthorized: boolean } } = { url };
  if (needsSsl(hostname, url)) {
    fallback.ssl = { rejectUnauthorized: false };
  }
  return fallback;
}

export type BuildTypeOrmOptionsInput = {
  connectionString: string;
  /** When true, TypeORM will auto-create schema (dev only). Prefer migrations in production. */
  synchronize?: boolean;
  logging?: boolean;
};

/** Build Nest/TypeORM DataSource options (entities registered). */
export async function buildTypeOrmOptions(
  input: BuildTypeOrmOptionsInput,
): Promise<DataSourceOptions> {
  const resolved = await resolveDatabaseConnection(input.connectionString);
  const base = {
    type: 'postgres' as const,
    entities: [...ALL_ENTITIES],
    synchronize: input.synchronize ?? false,
    logging: input.logging ?? false,
    // Existing DBs from DDL bootstrap; don't drop on mismatch.
  };

  if ('url' in resolved) {
    return {
      ...base,
      url: resolved.url,
      ssl: resolved.ssl,
      extra: { connectionTimeoutMillis: 15_000 },
    };
  }

  return {
    ...base,
    host: resolved.host,
    port: resolved.port,
    username: resolved.username,
    password: resolved.password,
    database: resolved.database,
    ssl: resolved.ssl,
    extra: { connectionTimeoutMillis: 15_000 },
  };
}
