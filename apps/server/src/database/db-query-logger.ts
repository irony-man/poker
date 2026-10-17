import { Logger } from '@nestjs/common';
import { EventSubscriber, type AfterQueryEvent, type EntitySubscriberInterface } from 'typeorm';

const MAX_SQL_CHARS = 2000;
const MAX_PARAM_CHARS = 200;
const DEFAULT_SLOW_QUERY_MS = 500;

function envFlag(raw: string | undefined): boolean | null {
  const flag = raw?.trim().toLowerCase();
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return null;
}

/** On by default; `LOG_DB_QUERIES=0` hides successful queries (failures and slow queries still log). */
export function dbQueryLoggingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return envFlag(env.LOG_DB_QUERIES) ?? true;
}

/** Off by default: params carry password hashes, tokens, and emails. */
export function dbQueryParamsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return envFlag(env.LOG_DB_PARAMS) ?? false;
}

export function dbSlowQueryMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.DB_SLOW_QUERY_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SLOW_QUERY_MS;
}

export function formatSql(sql: string): string {
  const flat = sql.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_SQL_CHARS ? `${flat.slice(0, MAX_SQL_CHARS)}…` : flat;
}

export function formatParams(params: unknown[] | undefined, showValues: boolean): string {
  if (!params?.length) return '';
  if (!showValues) return ` [${params.length} params]`;
  const values = params.map((p) => {
    let text: string;
    try {
      text = typeof p === 'string' ? p : JSON.stringify(p) ?? String(p);
    } catch {
      text = String(p);
    }
    return text.length > MAX_PARAM_CHARS ? `${text.slice(0, MAX_PARAM_CHARS)}…` : text;
  });
  return ` params=${JSON.stringify(values)}`;
}

function rowCountOf(raw: unknown): number | null {
  if (raw && typeof raw === 'object' && 'rowCount' in raw) {
    const n = (raw as { rowCount: unknown }).rowCount;
    if (typeof n === 'number') return n;
  }
  if (Array.isArray(raw)) return raw.length;
  return null;
}

function describeError(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err);
  const e = err as { code?: unknown; message?: unknown; detail?: unknown };
  const parts = [
    typeof e.code === 'string' ? `[${e.code}]` : '',
    typeof e.message === 'string' ? e.message : String(err),
    typeof e.detail === 'string' ? `(${e.detail})` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

/** Logs every SQL statement TypeORM runs (wrapper, raw `dataSource.query`, and schema sync). */
@EventSubscriber()
export class DbQueryLogSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger('DB');
  private readonly logQueries = dbQueryLoggingEnabled();
  private readonly showParams = dbQueryParamsEnabled();
  private readonly slowMs = dbSlowQueryMs();

  afterQuery(event: AfterQueryEvent<unknown>): void {
    const sql = formatSql(event.query);
    const params = formatParams(event.parameters, this.showParams);

    if (!event.success) {
      this.logger.error(`Query failed: ${describeError(event.error)} — ${sql}${params}`);
      return;
    }

    const ms = event.executionTime ?? 0;
    const rows = rowCountOf(event.rawResults);
    const line = `${ms}ms${rows == null ? '' : ` ${rows} rows`} ${sql}${params}`;
    if (ms >= this.slowMs) this.logger.warn(`Slow query ${line}`);
    else if (this.logQueries) this.logger.log(line);
  }
}
