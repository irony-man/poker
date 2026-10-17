import { describe, expect, it } from 'vitest';
import { rankSuggestions } from './friends/suggestions.js';

describe('rankSuggestions', () => {
  it('scores mutual friends above a few shared hands and labels the reason', () => {
    const ranked = rankSuggestions({
      mutual: new Map([
        ['carol', ['bob', 'dave']],
        ['erin', ['bob']],
      ]),
      handsTogether: new Map([
        ['erin', 4],
        ['frank', 2],
      ]),
      exclude: new Set(),
    });
    expect(ranked.map((r) => [r.userId, r.score, r.reason])).toEqual([
      ['erin', 7, 'both'],
      ['carol', 6, 'mutual'],
      ['frank', 2, 'played'],
    ]);
  });

  it('caps the played-together contribution', () => {
    const [top] = rankSuggestions({
      mutual: new Map(),
      handsTogether: new Map([['grinder', 150]]),
      exclude: new Set(),
    });
    expect(top!.score).toBe(10);
    expect(top!.handsTogether).toBe(150);
  });

  it('drops excluded ids and bots', () => {
    const ranked = rankSuggestions({
      mutual: new Map([['bob', ['carol']]]),
      handsTogether: new Map([
        ['bot:balanced:x1', 50],
        ['dave', 1],
      ]),
      exclude: new Set(['bob']),
    });
    expect(ranked.map((r) => r.userId)).toEqual(['dave']);
  });

  it('breaks ties by name and respects the limit', () => {
    const names: Record<string, string> = { u1: 'Zed', u2: 'Amy', u3: 'Max' };
    const ranked = rankSuggestions({
      mutual: new Map(),
      handsTogether: new Map([
        ['u1', 3],
        ['u2', 3],
        ['u3', 3],
      ]),
      exclude: new Set(),
      limit: 2,
      nameOf: (id) => names[id]!,
    });
    expect(ranked.map((r) => r.userId)).toEqual(['u2', 'u3']);
  });
});
