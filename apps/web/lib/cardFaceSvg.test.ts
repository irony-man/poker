import { describe, expect, it } from 'vitest';
import { sanitizeCardFaceSvg } from './cardFaceSvg';

describe('sanitizeCardFaceSvg', () => {
  it('accepts simple svg', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>';
    expect(sanitizeCardFaceSvg(svg)).toContain('<svg');
  });

  it('rejects script tags', () => {
    const svg = '<svg><script>alert(1)</script></svg>';
    expect(sanitizeCardFaceSvg(svg)).toBe('');
  });
});
