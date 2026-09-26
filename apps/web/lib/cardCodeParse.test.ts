import { describe, expect, it } from 'vitest';
import { parseCardPreviewCode } from './cardCodeParse';

describe('parseCardPreviewCode', () => {
  it('parses two-char engine codes', () => {
    const p = parseCardPreviewCode('Ah');
    expect(p.rank).toBe('A');
    expect(p.engineCode).toBe('Ah');
    expect(p.suitKey).toBe('h');
  });

  it('parses ten with suit suffix', () => {
    const p = parseCardPreviewCode('10d');
    expect(p.rank).toBe('10');
    expect(p.engineCode).toBe('Td');
    expect(p.suitKey).toBe('d');
  });
});
