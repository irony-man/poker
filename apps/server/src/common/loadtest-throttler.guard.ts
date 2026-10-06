import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';

export const LOADTEST_TOKEN_HEADER = 'x-loadtest-token';

/** True only when `expected` is configured and `provided` matches it exactly. */
export function loadtestTokenMatches(
  expected: string | undefined,
  provided: string | string[] | undefined,
): boolean {
  const want = expected?.trim();
  if (!want) return false;
  const got = Array.isArray(provided) ? provided[0] : provided;
  if (!got) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Throttler that lets the load-test service through when `LOADTEST_TOKEN` is set and the
 * request carries a matching `x-loadtest-token` header. Unset token → normal throttling.
 */
@Injectable()
export class LoadtestThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
      if (loadtestTokenMatches(process.env.LOADTEST_TOKEN, req.headers?.[LOADTEST_TOKEN_HEADER])) {
        return true;
      }
    }
    return super.shouldSkip(context);
  }
}
