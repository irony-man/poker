import { BadRequestException, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter.js';
import {
  GENERIC_ERROR_MESSAGE,
  databaseHttpError,
  isDatabaseError,
  publicErrorMessage,
} from './public-error.js';

const FK_MESSAGE =
  'insert or update on table "auth_sessions" violates foreign key constraint "FK_50ccaa6440288a06f0ba693ccc6"';

/** Shape of a `pg` DatabaseError. */
function pgError(code: string, message = FK_MESSAGE) {
  return Object.assign(new Error(message), {
    name: 'DatabaseError',
    code,
    severity: 'ERROR',
    routine: 'ri_ReportViolation',
  });
}

function runFilter(exception: unknown) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new ApiExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
}

describe('public errors', () => {
  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('detects pg and TypeORM database errors', () => {
    expect(isDatabaseError(pgError('23503'))).toBe(true);
    expect(isDatabaseError(new QueryFailedError('SELECT 1', [], pgError('23505')))).toBe(true);
    expect(isDatabaseError(new Error('Table full'))).toBe(false);
  });

  it('maps SQLSTATE codes to friendly HTTP errors', () => {
    expect(databaseHttpError(pgError('23505')).getStatus()).toBe(HttpStatus.CONFLICT);
    expect(databaseHttpError(pgError('23503')).getStatus()).toBe(HttpStatus.CONFLICT);
    expect(databaseHttpError(pgError('22P02')).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(databaseHttpError(pgError('57P01')).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(databaseHttpError(pgError('XX000')).getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    const conn = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    expect(databaseHttpError(conn).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('publicErrorMessage keeps domain messages and hides internals', () => {
    expect(publicErrorMessage(new Error('Invite code already in use'), 'Failed')).toBe(
      'Invite code already in use',
    );
    const db = publicErrorMessage(pgError('23503'), 'Login failed');
    expect(db).not.toMatch(/auth_sessions|constraint/i);
    expect(publicErrorMessage(new TypeError("Cannot read properties of undefined (reading 'id')"), 'Failed')).toBe(
      'Failed',
    );
    expect(publicErrorMessage('nope', 'Failed')).toBe('Failed');
  });

  it('filter maps raw database errors without leaking SQL', () => {
    const { status, body } = runFilter(pgError('23503'));
    expect(status).toBe(HttpStatus.CONFLICT);
    expect(body.error).not.toMatch(/auth_sessions|constraint/i);
  });

  it('filter scrubs DB text already wrapped in an HttpException', () => {
    const { status, body } = runFilter(new BadRequestException({ error: FK_MESSAGE }));
    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body).toEqual({ error: GENERIC_ERROR_MESSAGE });
  });

  it('filter passes through normal HttpException messages', () => {
    const { body } = runFilter(new BadRequestException({ error: 'Username taken' }));
    expect(body).toEqual({ error: 'Username taken' });
  });

  it('filter hides runtime bugs behind a generic 500', () => {
    const { status, body } = runFilter(new TypeError('x.map is not a function'));
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body).toEqual({ error: GENERIC_ERROR_MESSAGE });
  });
});
