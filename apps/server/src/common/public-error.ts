import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TypeORMError } from 'typeorm';

const logger = new Logger('PublicError');

export const GENERIC_ERROR_MESSAGE = 'Something went wrong on our side. Please try again.';
const UNAVAILABLE_MESSAGE = "We're having trouble reaching our servers. Please try again shortly.";
const BUSY_MESSAGE = 'The server is busy right now. Please try again in a moment.';
const DUPLICATE_MESSAGE = 'That already exists. Please try something different.';
const STALE_REFERENCE_MESSAGE =
  'Something you were using is no longer available. Please refresh and try again.';
const INVALID_DATA_MESSAGE = 'Some of the information sent was invalid. Please check it and try again.';

/** Text that only ever comes from SQL, drivers, or runtime internals — never shown to users. */
const INTERNAL_MESSAGE_PATTERNS: RegExp[] = [
  /violates (foreign key|unique|not-null|check|exclusion) constraint/i,
  /duplicate key value/i,
  /\b(relation|column|table|schema|database|role) "[^"]*" (does not exist|of relation)/i,
  /syntax error at or near/i,
  /invalid input (syntax|value) for/i,
  /value too long for type/i,
  /out of range for type/i,
  /deadlock detected/i,
  /could not serialize access/i,
  /\bon table "/i,
  /\bQueryFailedError\b|\bEntityNotFoundError\b|\bTypeORMError\b/,
  /\b(ECONNREFUSED|ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN)\b/,
  /connection (terminated|refused|timeout|timed out)/i,
  /too many (clients|connections)/i,
  /\bpg_[a-z_]+\b/i,
  /Cannot read propert(y|ies) of (undefined|null)/,
  /Unexpected token .* in JSON/,
];

const DRIVER_CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
]);

type DriverErrorLike = {
  name?: unknown;
  code?: unknown;
  severity?: unknown;
  routine?: unknown;
  driverError?: unknown;
  message?: unknown;
};

function sqlState(err: unknown): string | null {
  const e = err as DriverErrorLike | null;
  if (!e || typeof e !== 'object') return null;
  const code = typeof e.code === 'string' ? e.code : null;
  if (code && /^[0-9A-Z]{5}$/.test(code) && (e.severity !== undefined || e.routine !== undefined)) {
    return code;
  }
  if (e.driverError) return sqlState(e.driverError);
  return null;
}

function driverCode(err: unknown): string | null {
  const e = err as DriverErrorLike | null;
  if (!e || typeof e !== 'object') return null;
  if (typeof e.code === 'string' && DRIVER_CONNECTION_CODES.has(e.code)) return e.code;
  if (e.driverError) return driverCode(e.driverError);
  return null;
}

/** True when a message reads like SQL / driver / runtime internals. */
export function looksLikeInternalMessage(message: string): boolean {
  return INTERNAL_MESSAGE_PATTERNS.some((re) => re.test(message));
}

/** Postgres, TypeORM, or DB-connection failure. */
export function isDatabaseError(err: unknown): boolean {
  if (err instanceof TypeORMError) return true;
  if (sqlState(err) || driverCode(err)) return true;
  const name = (err as DriverErrorLike | null)?.name;
  return name === 'DatabaseError' || name === 'QueryFailedError';
}

/** Map a database failure to an HTTP error with a message users can act on. */
export function databaseHttpError(err: unknown): HttpException {
  const state = sqlState(err);
  if (state === '23505') return new ConflictException({ error: DUPLICATE_MESSAGE });
  if (state === '23503') return new ConflictException({ error: STALE_REFERENCE_MESSAGE });
  if (state === '23502' || state === '23514' || state?.startsWith('22')) {
    return new BadRequestException({ error: INVALID_DATA_MESSAGE });
  }
  if (state === '40001' || state === '40P01' || state === '55P03') {
    return new ServiceUnavailableException({ error: BUSY_MESSAGE });
  }
  if (
    driverCode(err) ||
    state?.startsWith('08') ||
    state?.startsWith('53') ||
    state?.startsWith('57P')
  ) {
    return new ServiceUnavailableException({ error: UNAVAILABLE_MESSAGE });
  }
  return new InternalServerErrorException({ error: GENERIC_ERROR_MESSAGE });
}

function isRuntimeBug(err: unknown): boolean {
  return (
    err instanceof TypeError ||
    err instanceof ReferenceError ||
    err instanceof SyntaxError ||
    err instanceof RangeError
  );
}

/** Error whose own message is a deliberate, user-facing domain message. */
export function isUserFacingError(err: unknown): err is Error {
  return (
    err instanceof Error &&
    !!err.message.trim() &&
    !isDatabaseError(err) &&
    !isRuntimeBug(err) &&
    !looksLikeInternalMessage(err.message)
  );
}

/**
 * Message safe to send to clients for a caught error: the domain message when it is
 * user-facing, otherwise a friendly generic one. Suppressed errors are logged.
 */
export function publicErrorMessage(err: unknown, fallback: string): string {
  if (isUserFacingError(err)) return err.message;
  if (err instanceof Error) logger.error(err.stack ?? err.message);
  else if (err != null) logger.error(String(err));
  if (isDatabaseError(err)) {
    return (databaseHttpError(err).getResponse() as { error: string }).error;
  }
  return fallback;
}
