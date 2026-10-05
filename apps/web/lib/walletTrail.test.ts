import { describe, expect, it } from 'vitest';
import { parseWalletCurrency, walletEntryHref, walletReasonLabel } from './walletTrail';

describe('walletReasonLabel', () => {
  it('labels known reasons per currency', () => {
    expect(walletReasonLabel('signup_grant', 'chips')).toBe('Welcome chips');
    expect(walletReasonLabel('signup_grant', 'whuffies')).toBe('Welcome Whuffies');
    expect(walletReasonLabel('offline_win', 'whuffies')).toBe('Beat the bots');
    expect(walletReasonLabel('opening_balance', 'chips')).toBe('Starting balance');
  });

  it('title-cases unknown reasons', () => {
    expect(walletReasonLabel('daily_spin_bonus', 'chips')).toBe('Daily Spin Bonus');
  });
});

describe('walletEntryHref', () => {
  it('links contest entries only', () => {
    expect(walletEntryHref({ reason: 'contest_prize', refId: 'abc' })).toBe('/contest/abc');
    expect(walletEntryHref({ reason: 'cash_out', refId: 'abc' })).toBe('/contest/abc');
    expect(walletEntryHref({ reason: 'offline_win', refId: 'solo-1' })).toBeNull();
    expect(walletEntryHref({ reason: 'contest_prize', refId: '' })).toBeNull();
  });
});

describe('parseWalletCurrency', () => {
  it('defaults to chips', () => {
    expect(parseWalletCurrency('whuffies')).toBe('whuffies');
    expect(parseWalletCurrency(null)).toBe('chips');
    expect(parseWalletCurrency('gold')).toBe('chips');
  });
});
