import { describe, expect, it } from 'vitest';
import { DEFAULT_LOBBY_NAV } from '@poker/protocol';
import { DEFAULT_HOME_FEATURES } from '@/lib/homeFeaturesDefaults';
import { resolveHomeFeaturesForSeo } from '@/lib/homeFeatures';

describe('resolveHomeFeaturesForSeo', () => {
  it('falls back to defaults when site payload is empty', () => {
    const features = resolveHomeFeaturesForSeo({}, DEFAULT_LOBBY_NAV);
    expect(features.length).toBeGreaterThan(0);
    expect(features[0]?.title).toBe(DEFAULT_HOME_FEATURES[0]?.title);
  });

  it('prefers admin homeFeatures when provided', () => {
    const custom = [{ ...DEFAULT_HOME_FEATURES[0]!, title: 'Custom contests block' }];
    const features = resolveHomeFeaturesForSeo({ homeFeatures: custom }, DEFAULT_LOBBY_NAV);
    expect(features[0]?.title).toBe('Custom contests block');
  });
});
