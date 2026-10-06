import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Target = {
  name: string;
  apiUrl: string;
  wsUrl: string;
};

export type ServiceConfig = {
  host: string;
  port: number;
  adminToken: string;
  /** Sent as `x-loadtest-token` so the target server skips rate limits. Blank → not sent. */
  loadtestToken: string;
  targets: Target[];
  maxVus: number;
  reportsDir: string;
  publicDir: string;
  cookieSecure: boolean;
};

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function deriveWsUrl(apiUrl: string): string {
  const u = new URL(apiUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = `${u.pathname.replace(/\/+$/, '')}/ws`;
  return trimSlash(u.toString());
}

/**
 * `LOADTEST_TARGETS` = comma-separated `name=apiUrl|wsUrl` entries. `|wsUrl` is optional
 * (defaults to `<apiUrl>/ws` with ws/wss scheme). A bare URL gets its host as the name.
 */
export function parseTargets(raw: string | undefined): Target[] {
  if (!raw?.trim()) return [];
  const out: Target[] = [];
  for (const entry of raw.split(',')) {
    const item = entry.trim();
    if (!item) continue;
    const eq = item.indexOf('=');
    const hasName = eq > 0 && !item.slice(0, eq).includes('://');
    const urls = hasName ? item.slice(eq + 1) : item;
    const [apiRaw, wsRaw] = urls.split('|').map((s) => s.trim());
    if (!apiRaw) throw new Error(`Invalid LOADTEST_TARGETS entry: ${item}`);
    const api = new URL(apiRaw);
    if (api.protocol !== 'http:' && api.protocol !== 'https:') {
      throw new Error(`Target API URL must be http(s): ${apiRaw}`);
    }
    const apiUrl = trimSlash(api.toString());
    const wsUrl = wsRaw ? trimSlash(new URL(wsRaw).toString()) : deriveWsUrl(apiUrl);
    if (!/^wss?:/.test(wsUrl)) throw new Error(`Target WS URL must be ws(s): ${wsRaw}`);
    const name = hasName ? item.slice(0, eq).trim() : api.host;
    if (out.some((t) => t.name === name)) throw new Error(`Duplicate target name: ${name}`);
    out.push({ name, apiUrl, wsUrl });
  }
  return out;
}

function intEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const adminToken = env.LOADTEST_ADMIN_TOKEN?.trim() ?? '';
  if (adminToken.length < 12) {
    throw new Error('LOADTEST_ADMIN_TOKEN must be set (at least 12 characters) to start the load-test service');
  }
  const targets = parseTargets(env.LOADTEST_TARGETS ?? 'local=http://127.0.0.1:4000|ws://127.0.0.1:4000/ws');
  if (targets.length === 0) throw new Error('LOADTEST_TARGETS has no targets');
  return {
    host: env.LOADTEST_HOST?.trim() || '0.0.0.0',
    port: intEnv(env.LOADTEST_PORT ?? env.PORT, 4100, 1, 65535),
    adminToken,
    loadtestToken: env.LOADTEST_TOKEN?.trim() ?? '',
    targets,
    maxVus: intEnv(env.LOADTEST_MAX_VUS, 500, 1, 100_000),
    reportsDir: path.resolve(env.REPORTS_DIR?.trim() || path.join(APP_ROOT, 'data')),
    publicDir: path.join(APP_ROOT, 'public'),
    cookieSecure: env.LOADTEST_COOKIE_SECURE === 'true',
  };
}
