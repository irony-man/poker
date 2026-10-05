import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  GENERIC_ERROR_MESSAGE,
  databaseHttpError,
  isDatabaseError,
  isUserFacingError,
  looksLikeInternalMessage,
} from './public-error.js';

function httpExceptionMessage(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.message === 'string') return obj.message;
    if (Array.isArray(obj.message)) return obj.message.join(', ');
  }
  return exception.message;
}

/**
 * Flatten Nest errors to `{ error: string }` so web/Android clients stay compatible.
 * Database and runtime internals are logged and replaced with a friendly message.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = httpExceptionMessage(exception);
      if (looksLikeInternalMessage(message) || isDatabaseError(exception.cause)) {
        this.logger.error(`Suppressed internal error (${status}): ${message}`);
        res.status(status).json({ error: GENERIC_ERROR_MESSAGE });
        return;
      }
      res.status(status).json({ error: message });
      return;
    }

    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));

    if (isDatabaseError(exception)) {
      const mapped = databaseHttpError(exception);
      res.status(mapped.getStatus()).json(mapped.getResponse());
      return;
    }

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: isUserFacingError(exception) ? exception.message : GENERIC_ERROR_MESSAGE,
    });
  }
}
