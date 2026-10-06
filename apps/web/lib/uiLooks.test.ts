import { describe, expect, it } from 'vitest';
import { DEFAULT_UI_LOOKS, normalizeUiLooks, resolveUiLook } from '@poker/protocol';

describe('normalizeUiLooks', () => {
  it('falls back to every look with Classic as default', () => {
    expect(normalizeUiLooks(undefined)).toEqual(DEFAULT_UI_LOOKS);
    expect(normalizeUiLooks({ visible: [] })).toEqual(DEFAULT_UI_LOOKS);
    expect(normalizeUiLooks({ visible: ['v9'] })).toEqual(DEFAULT_UI_LOOKS);
  });

  it('keeps canonical order, drops unknown ids and duplicates', () => {
    expect(normalizeUiLooks({ visible: ['v3', 'nope', 'v1', 'v3'], defaultLook: 'v3' })).toEqual({
      visible: ['v1', 'v3'],
      defaultLook: 'v3',
    });
  });

  it('moves a hidden default to the first visible look', () => {
    expect(normalizeUiLooks({ visible: ['v2', 'v3'], defaultLook: 'v1' })).toEqual({
      visible: ['v2', 'v3'],
      defaultLook: 'v2',
    });
  });
});

describe('resolveUiLook', () => {
  const config = normalizeUiLooks({ visible: ['v1', 'v2'], defaultLook: 'v2' });

  it('keeps a visible choice', () => {
    expect(resolveUiLook(config, 'v1')).toBe('v1');
  });

  it('falls back to the default for hidden, missing, or unknown choices', () => {
    expect(resolveUiLook(config, 'v3')).toBe('v2');
    expect(resolveUiLook(config, null)).toBe('v2');
    expect(resolveUiLook(config, 'retro')).toBe('v2');
  });
});
