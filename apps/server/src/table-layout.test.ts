import { describe, expect, it } from 'vitest';
import { DEFAULT_TABLE_LAYOUT, clampTableLayout } from './table-layout.js';

describe('clampTableLayout', () => {
  it('defaults to the stacked layout', () => {
    expect(DEFAULT_TABLE_LAYOUT).toBe('v2');
    expect(clampTableLayout(undefined)).toBe('v2');
    expect(clampTableLayout(null)).toBe('v2');
    expect(clampTableLayout('v3')).toBe('v2');
  });

  it('keeps an explicit layout choice', () => {
    expect(clampTableLayout('v1')).toBe('v1');
    expect(clampTableLayout('v2')).toBe('v2');
  });
});
