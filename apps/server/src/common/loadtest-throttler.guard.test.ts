import type { ExecutionContext } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LOADTEST_TOKEN_HEADER,
  LoadtestThrottlerGuard,
  loadtestTokenMatches,
} from './loadtest-throttler.guard.js';

function httpContext(headers: Record<string, string>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

/** Calls the protected `shouldSkip` without wiring a full Nest module. */
function shouldSkip(headers: Record<string, string>): Promise<boolean> {
  const guard = Object.create(LoadtestThrottlerGuard.prototype) as {
    shouldSkip(ctx: ExecutionContext): Promise<boolean>;
  };
  return guard.shouldSkip(httpContext(headers));
}

describe('loadtest throttler bypass', () => {
  const prev = process.env.LOADTEST_TOKEN;
  afterEach(() => {
    if (prev === undefined) delete process.env.LOADTEST_TOKEN;
    else process.env.LOADTEST_TOKEN = prev;
  });

  it('never matches when the token is unset or blank', () => {
    expect(loadtestTokenMatches(undefined, 'abc')).toBe(false);
    expect(loadtestTokenMatches('', '')).toBe(false);
    expect(loadtestTokenMatches('   ', '   ')).toBe(false);
  });

  it('matches only the exact token', () => {
    expect(loadtestTokenMatches('secret-1', 'secret-1')).toBe(true);
    expect(loadtestTokenMatches('secret-1', ['secret-1'])).toBe(true);
    expect(loadtestTokenMatches('secret-1', 'secret-2')).toBe(false);
    expect(loadtestTokenMatches('secret-1', 'secret-10')).toBe(false);
    expect(loadtestTokenMatches('secret-1', undefined)).toBe(false);
  });

  it('skips throttling only with a configured token and matching header', async () => {
    delete process.env.LOADTEST_TOKEN;
    expect(await shouldSkip({ [LOADTEST_TOKEN_HEADER]: 'secret-1' })).toBe(false);

    process.env.LOADTEST_TOKEN = 'secret-1';
    expect(await shouldSkip({ [LOADTEST_TOKEN_HEADER]: 'secret-1' })).toBe(true);
    expect(await shouldSkip({ [LOADTEST_TOKEN_HEADER]: 'wrong' })).toBe(false);
    expect(await shouldSkip({})).toBe(false);
  });
});
