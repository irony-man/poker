import { describe, expect, it } from 'vitest';
import type { WalletTrailEntry } from '@poker/protocol';
import {
  parseWalletCurrency,
  parseWalletTrailRange,
  parseWalletTrailView,
  walletActivityStats,
  walletBalanceSeries,
  walletEntryHref,
  walletEntryMatchesSource,
  walletRangeSince,
  walletRangeSummary,
  walletReasonLabel,
} from './walletTrail';

function entry(
  id: string,
  delta: number,
  balanceAfter: number | null,
  createdAt: number,
  reason = 'admin_credit',
): WalletTrailEntry {
  return { id, currency: 'chips', delta, balanceAfter, reason, refId: '', createdAt };
}

const DAY = 24 * 60 * 60 * 1000;

describe('walletRangeSummary', () => {
  const now = 100 * DAY;
  // Newest first: opening 1000 @ day 10, -200 @ day 50, +500 @ day 95.
  const entries = [
    entry('c', 500, 1_300, 95 * DAY, 'cash_out'),
    entry('b', -200, 800, 50 * DAY, 'buy_in'),
    entry('a', 1_000, 1_000, 10 * DAY, 'opening_balance'),
  ];
  const series = walletBalanceSeries(entries);

  it('starts the line at the balance held when the range begins', () => {
    const since = walletRangeSince('30d', now)!;
    const s = walletRangeSummary(series, { since, now, currentBalance: 1_300 })!;
    expect(s.from).toBe(since);
    expect(s.to).toBe(now);
    expect(s.chart.map((c) => [c.t, c.balance])).toEqual([
      [since, 800],
      [95 * DAY, 1_300],
      [now, 1_300],
    ]);
    expect(s.startBalance).toBe(800);
    expect(s.change).toBe(500);
    expect(s.high).toEqual({ balance: 1_300, t: 95 * DAY });
    expect(s.low).toEqual({ balance: 800, t: since });
  });

  it('uses the opening entry as the start for all time', () => {
    const s = walletRangeSummary(series, { since: null, now, currentBalance: 1_300 })!;
    expect(s.from).toBe(10 * DAY);
    expect(s.startBalance).toBe(1_000);
    expect(s.change).toBe(300);
    expect(s.low.balance).toBe(800);
  });

  it('starts at the first change when the range predates all history', () => {
    const s = walletRangeSummary(series, { since: 0, now, currentBalance: 1_300 })!;
    expect(s.from).toBe(10 * DAY);
    expect(s.chart[0]!.t).toBe(10 * DAY);
    expect(s.startBalance).toBe(1_000);
  });

  it('draws a flat line when nothing changed in the range', () => {
    const s = walletRangeSummary(series, { since: now - DAY, now, currentBalance: 1_300 })!;
    expect(s.chart.map((c) => c.balance)).toEqual([1_300, 1_300]);
    expect(s.change).toBe(0);
  });
});

describe('walletActivityStats', () => {
  it('totals gains and losses, skipping opening entries', () => {
    const stats = walletActivityStats([
      entry('e', 300, null, 5, 'contest_prize'),
      entry('d', 100, null, 4, 'offline_win'),
      entry('c', -50, null, 3, 'buy_in'),
      entry('b', 20, null, 2, 'free_refill'),
      entry('a', 1_000, null, 1, 'opening_balance'),
    ]);
    expect(stats).toMatchObject({
      changes: 4,
      gains: 3,
      losses: 1,
      earned: 420,
      spent: 50,
      net: 370,
      bestStreak: 2,
    });
    expect(stats.biggestGain?.id).toBe('e');
    expect(stats.biggestLoss?.id).toBe('c');
  });
});

describe('walletEntryMatchesSource', () => {
  it('splits game activity from everything else', () => {
    expect(walletEntryMatchesSource('buy_in', 'games')).toBe(true);
    expect(walletEntryMatchesSource('admin_credit', 'games')).toBe(false);
    expect(walletEntryMatchesSource('admin_credit', 'other')).toBe(true);
    expect(walletEntryMatchesSource('offline_win', 'other')).toBe(false);
    expect(walletEntryMatchesSource('anything', 'all')).toBe(true);
  });
});

describe('parseWalletTrailRange', () => {
  it('defaults to 90 days', () => {
    expect(parseWalletTrailRange('7d')).toBe('7d');
    expect(parseWalletTrailRange('all')).toBe('all');
    expect(parseWalletTrailRange(null)).toBe('90d');
    expect(parseWalletTrailRange('2w')).toBe('90d');
  });
});

describe('walletBalanceSeries', () => {
  it('returns oldest-first balances from stored values', () => {
    const series = walletBalanceSeries([entry('b', -200, 800, 2), entry('a', 1000, 1000, 1)]);
    expect(series.map((p) => [p.entry.id, p.balance, p.estimated])).toEqual([
      ['a', 1000, false],
      ['b', 800, false],
    ]);
  });

  it('rebuilds missing balances by walking back from the newest known one', () => {
    const series = walletBalanceSeries([
      entry('c', 500, 2_000, 3),
      entry('b', -1_000, null, 2),
      entry('a', 490, null, 1),
    ]);
    expect(series.map((p) => [p.entry.id, p.balance, p.estimated])).toEqual([
      ['a', 2_500, true],
      ['b', 1_500, true],
      ['c', 2_000, false],
    ]);
  });

  it('anchors on the current balance when no entry has one', () => {
    const series = walletBalanceSeries([entry('b', 490, null, 2), entry('a', -1_000, null, 1)], 24_675);
    expect(series.map((p) => p.balance)).toEqual([24_185, 24_675]);
  });

  it('skips entries it cannot place', () => {
    expect(walletBalanceSeries([entry('a', 5, null, 1)])).toEqual([]);
  });
});

describe('parseWalletTrailView', () => {
  it('defaults to list', () => {
    expect(parseWalletTrailView('list')).toBe('list');
    expect(parseWalletTrailView(null)).toBe('chart');
    expect(parseWalletTrailView('table')).toBe('chart');
  });
});

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
