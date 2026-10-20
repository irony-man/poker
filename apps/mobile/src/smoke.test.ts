import { sharedPackageSmoke } from './smoke';

describe('sharedPackageSmoke', () => {
  it('reads the shared engine deck and protocol stakes', () => {
    const smoke = sharedPackageSmoke();
    expect(smoke.deckCount).toBe(52);
    expect(smoke.stakeIds).toEqual(['micro', 'low', 'mid', 'high']);
    expect(smoke.pingValid).toBe(true);
  });
});
