import { describe, expect, it } from 'vitest';
import { computeRevealedWinPct } from './showdownEquity';

describe('computeRevealedWinPct', () => {
  it('single revealed hand is 100%', () => {
    const map = computeRevealedWinPct(
      [{ seat: 0, holeCards: ['As', 'Kh'] }],
      ['2c', '7d', '9h', '3s', 'Td'],
    );
    expect(map.get(0)).toBe(100);
  });

  it('exact river: better hand gets 100%', () => {
    const map = computeRevealedWinPct(
      [
        { seat: 0, holeCards: ['As', 'Ad'] },
        { seat: 1, holeCards: ['2c', '2d'] },
      ],
      ['Kh', '7d', '9h', '3s', 'Td'],
    );
    expect(map.get(0)).toBe(100);
    expect(map.get(1)).toBe(0);
  });

  it('exact river tie splits', () => {
    const map = computeRevealedWinPct(
      [
        { seat: 0, holeCards: ['As', '2c'] },
        { seat: 1, holeCards: ['Ad', '3d'] },
      ],
      ['Ah', 'Kh', 'Qh', 'Jh', '9c'],
    );
    // Both play the same board broadway / same pair Ace high with kicker from board
    const a = map.get(0)!;
    const b = map.get(1)!;
    expect(a + b).toBe(100);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
  });
});
