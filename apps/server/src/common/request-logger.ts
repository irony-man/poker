import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** On outside production unless `LOG_REQUESTS=0`; `LOG_REQUESTS=1` forces it on in production. */
export function requestLoggingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.LOG_REQUESTS?.trim().toLowerCase();
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/** Logs one line per HTTP request once the response finishes (or the client aborts). */
export function requestLogger(logger = new Logger('HTTP')) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    const url = req.originalUrl || req.url;
    let logged = false;
    const log = (aborted: boolean) => {
      if (logged) return;
      logged = true;
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const status = aborted && !res.headersSent ? 'aborted' : String(res.statusCode);
      const line = `${req.method} ${url} ${status} ${ms.toFixed(1)}ms`;
      if (res.statusCode >= 500) logger.error(line);
      else if (res.statusCode >= 400 || aborted) logger.warn(line);
      else logger.log(line);
    };
    res.on('finish', () => log(false));
    res.on('close', () => log(!res.writableFinished));
    next();
  };
}
