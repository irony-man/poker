import { Logger } from '@nestjs/common';
import type { AfterQueryEvent } from 'typeorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DbQueryLogSubscriber,
  dbQueryLoggingEnabled,
  dbQueryParamsEnabled,
  dbSlowQueryMs,
  formatParams,
  formatSql,
} from './db-query-logger.js';

function event(partial: Partial<AfterQueryEvent<unknown>>): AfterQueryEvent<unknown> {
  return {
    query: 'SELECT 1',
    success: true,
    executionTime: 3,
    ...partial,
  } as AfterQueryEvent<unknown>;
}

describe('db query logging flags', () => {
  it('logs queries by default and honours LOG_DB_QUERIES', () => {
    expect(dbQueryLoggingEnabled({})).toBe(true);
    expect(dbQueryLoggingEnabled({ LOG_DB_QUERIES: '0' })).toBe(false);
    expect(dbQueryLoggingEnabled({ LOG_DB_QUERIES: 'true' })).toBe(true);
  });

  it('hides param values unless LOG_DB_PARAMS is set', () => {
    expect(dbQueryParamsEnabled({})).toBe(false);
    expect(dbQueryParamsEnabled({ LOG_DB_PARAMS: '1' })).toBe(true);
  });

  it('reads DB_SLOW_QUERY_MS with a 500ms default', () => {
    expect(dbSlowQueryMs({})).toBe(500);
    expect(dbSlowQueryMs({ DB_SLOW_QUERY_MS: '50' })).toBe(50);
    expect(dbSlowQueryMs({ DB_SLOW_QUERY_MS: 'nope' })).toBe(500);
  });
});

describe('formatting', () => {
  it('collapses whitespace in SQL', () => {
    expect(formatSql('SELECT *\n    FROM users\n  WHERE id = $1')).toBe(
      'SELECT * FROM users WHERE id = $1',
    );
  });

  it('shows only a param count unless values are enabled', () => {
    expect(formatParams(['secret', 2], false)).toBe(' [2 params]');
    expect(formatParams(['a', 2, null], true)).toBe(' params=["a","2","null"]');
    expect(formatParams([], true)).toBe('');
  });
});

describe('DbQueryLogSubscriber', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_DB_QUERIES;
  });

  it('logs successful queries with duration and row count', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    new DbQueryLogSubscriber().afterQuery(
      event({ query: 'SELECT id FROM users', rawResults: { rowCount: 2 }, parameters: ['x'] }),
    );
    expect(log).toHaveBeenCalledWith('3ms 2 rows SELECT id FROM users [1 params]');
  });

  it('logs failures as errors even when query logging is off', () => {
    process.env.LOG_DB_QUERIES = '0';
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    new DbQueryLogSubscriber().afterQuery(
      event({
        query: 'INSERT INTO users (name) VALUES ($1)',
        success: false,
        executionTime: undefined,
        error: { code: '23505', message: 'duplicate key value', detail: 'Key (name)=(bob)' },
      }),
    );
    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      'Query failed: [23505] duplicate key value (Key (name)=(bob)) — INSERT INTO users (name) VALUES ($1)',
    );
  });

  it('warns on slow queries', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    new DbQueryLogSubscriber().afterQuery(event({ executionTime: 900 }));
    expect(warn).toHaveBeenCalledWith('Slow query 900ms SELECT 1');
  });
});
