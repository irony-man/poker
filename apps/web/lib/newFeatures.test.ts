import { describe, expect, it } from 'vitest';
import { isFeatureNew, markFeatureSeen, newFeatureStorageKey } from './newFeatures';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('new feature badges', () => {
  it('stays new until the player opens the feature', () => {
    const storage = memoryStorage();
    expect(isFeatureNew('solo-bot-groups', storage)).toBe(true);
    markFeatureSeen('solo-bot-groups', storage);
    expect(isFeatureNew('solo-bot-groups', storage)).toBe(false);
    expect(isFeatureNew('host-bot-groups', storage)).toBe(true);
    expect(storage.data.get(newFeatureStorageKey('solo-bot-groups'))).toBe('1');
  });

  it('shows no badge when storage is unavailable', () => {
    expect(isFeatureNew('profile-theme', null)).toBe(false);
    expect(() => markFeatureSeen('profile-theme', null)).not.toThrow();
  });

  it('shows no badge when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(isFeatureNew('profile-theme', broken)).toBe(false);
    expect(() => markFeatureSeen('profile-theme', broken)).not.toThrow();
  });
});
