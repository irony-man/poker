import { describe, expect, it } from 'vitest';
import { requestLoggingEnabled } from './request-logger.js';

describe('requestLoggingEnabled', () => {
  it('is on outside production by default', () => {
    expect(requestLoggingEnabled({})).toBe(true);
    expect(requestLoggingEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(requestLoggingEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('honours LOG_REQUESTS', () => {
    expect(requestLoggingEnabled({ NODE_ENV: 'production', LOG_REQUESTS: '1' })).toBe(true);
    expect(requestLoggingEnabled({ NODE_ENV: 'development', LOG_REQUESTS: 'false' })).toBe(false);
  });
});
