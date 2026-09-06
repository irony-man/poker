import { describe, expect, it } from 'vitest';
import { isAllowedOrigin, parseExtraOrigins } from './cors.js';

describe('cors allowlist', () => {
  it('allows production apex and www without WEB_ORIGIN', () => {
    expect(isAllowedOrigin('https://pokr.site', [])).toBe(true);
    expect(isAllowedOrigin('https://www.pokr.site', [])).toBe(true);
  });

  it('normalizes trailing slashes on extras and request origin', () => {
    const extras = parseExtraOrigins('https://staging.example/ , http://localhost:3000/');
    expect(extras).toEqual(['https://staging.example', 'http://localhost:3000']);
    expect(isAllowedOrigin('https://staging.example/', extras)).toBe(true);
  });

  it('allows render and cloudflare preview hosts', () => {
    expect(isAllowedOrigin('https://felt-web.onrender.com', [])).toBe(true);
    expect(isAllowedOrigin('https://abc-xyz.trycloudflare.com', [])).toBe(true);
  });

  it('rejects unknown origins', () => {
    expect(isAllowedOrigin('https://evil.example', [])).toBe(false);
  });
});
