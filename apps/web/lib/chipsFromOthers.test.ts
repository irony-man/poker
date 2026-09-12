import { describe, expect, it } from 'vitest';
import { chipsFromOthers } from './chipsFromOthers';

describe('chipsFromOthers', () => {
  it('subtracts the winner contribution from the pot award', () => {
    expect(chipsFromOthers(85, 20)).toBe(65);
  });

  it('treats missing committed as zero (full award)', () => {
    expect(chipsFromOthers(85, undefined)).toBe(85);
    expect(chipsFromOthers(85, null)).toBe(85);
  });

  it('never goes negative', () => {
    expect(chipsFromOthers(30, 50)).toBe(0);
  });
});
