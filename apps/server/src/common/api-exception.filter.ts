import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Flatten Nest errors to `{ error: string }` so web/Android clients stay compatible.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        res.status(status).json({ error: body });
        return;
      }
      if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        if (typeof obj.error === 'string') {
          res.status(status).json({ error: obj.error });
          return;
        }
        if (typeof obj.message === 'string') {
          res.status(status).json({ error: obj.message });
          return;
        }
        if (Array.isArray(obj.message)) {
          res.status(status).json({ error: obj.message.join(', ') });
          return;
        }
      }
      res.status(status).json({ error: exception.message });
      return;
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error';
    console.error(exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: message });
  }
}
