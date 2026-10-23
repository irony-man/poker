import { describe, expect, it } from 'vitest';
import { gateLinks } from './gate';

describe('gate next', () => {
  it('builds sign-in and sign-up links that return to the poker path', () => {
    const links = gateLinks('/public?stake=low');
    expect(links.signIn).toContain('next=');
    expect(decodeURIComponent(links.signIn.split('next=')[1] ?? '')).toBe('/public?stake=low');
    expect(links.signUp.startsWith('/sign-up?next=')).toBe(true);
    expect(links.offline).toBe('/solo');
  });

  it('drops off-site next values', () => {
    expect(gateLinks('https://evil.example').next).toBe('/');
  });
});
