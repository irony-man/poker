import type { WalletCurrency, WalletTrailEntry } from '@poker/protocol';

const REASON_LABELS: Record<string, string> = {
  opening_balance: 'Starting balance',
  free_refill: 'Free refill',
  buy_in: 'Table buy-in',
  top_up: 'Table top-up',
  cash_out: 'Contest refund',
  hand_win: 'Hand won',
  hand_loss: 'Hand lost',
  admin_credit: 'Bonus from staff',
  admin_reset: 'Balance reset',
  contest_prize: 'Contest prize',
  offline_win: 'Beat the bots',
};

function titleCase(reason: string): string {
  return reason
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

export function walletReasonLabel(reason: string, currency: WalletCurrency): string {
  if (reason === 'signup_grant') {
    return currency === 'chips' ? 'Welcome chips' : 'Welcome Whuffies';
  }
  return REASON_LABELS[reason] ?? titleCase(reason);
}

/** Contest page for entries tied to a contest, else null. */
export function walletEntryHref(entry: Pick<WalletTrailEntry, 'reason' | 'refId'>): string | null {
  if (!entry.refId) return null;
  if (entry.reason === 'contest_prize' || entry.reason === 'cash_out') {
    return `/contest/${encodeURIComponent(entry.refId)}`;
  }
  return null;
}

export function parseWalletCurrency(raw: string | null | undefined): WalletCurrency {
  return raw === 'whuffies' ? 'whuffies' : 'chips';
}

export type WalletTrailView = 'list' | 'chart';

export const DEFAULT_WALLET_TRAIL_VIEW: WalletTrailView = 'chart';

export function parseWalletTrailView(raw: string | null | undefined): WalletTrailView {
  return raw === 'chart' || raw === 'list' ? raw : DEFAULT_WALLET_TRAIL_VIEW;
}

export type WalletBalancePoint = {
  entry: WalletTrailEntry;
  /** Balance right after this entry. */
  balance: number;
  /** True when derived from later entries because the row predates stored balances. */
  estimated: boolean;
};

/**
 * Oldest-first balance after each entry. `entries` must be newest-first and contiguous
 * from the latest change, so missing balances can be rebuilt by walking back from the
 * newest known balance (or `currentBalance` when even the newest row lacks one).
 */
export function walletBalanceSeries(
  entries: readonly WalletTrailEntry[],
  currentBalance?: number | null,
): WalletBalancePoint[] {
  const points: WalletBalancePoint[] = [];
  let running: number | null =
    entries[0]?.balanceAfter ??
    (currentBalance != null && Number.isFinite(currentBalance) ? currentBalance : null);
  for (const entry of entries) {
    const balance = entry.balanceAfter ?? running;
    if (balance == null) {
      running = null;
      continue;
    }
    points.push({ entry, balance, estimated: entry.balanceAfter == null });
    running = balance - entry.delta;
  }
  return points.reverse();
}

export type WalletTrailRange = '7d' | '30d' | '90d' | '1y' | 'all';

const DAY_MS = 24 * 60 * 60 * 1000;

export const WALLET_TRAIL_RANGES: ReadonlyArray<{
  id: WalletTrailRange;
  label: string;
  days: number | null;
}> = [
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: '1y', label: '1 year', days: 365 },
  { id: 'all', label: 'All time', days: null },
];

export const DEFAULT_WALLET_TRAIL_RANGE: WalletTrailRange = '90d';

export function parseWalletTrailRange(raw: string | null | undefined): WalletTrailRange {
  return WALLET_TRAIL_RANGES.some((r) => r.id === raw)
    ? (raw as WalletTrailRange)
    : DEFAULT_WALLET_TRAIL_RANGE;
}

/** Start of the range in ms, or null for all time. */
export function walletRangeSince(range: WalletTrailRange, now: number): number | null {
  const days = WALLET_TRAIL_RANGES.find((r) => r.id === range)?.days ?? null;
  return days == null ? null : now - days * DAY_MS;
}

export type WalletTrailSource = 'all' | 'games' | 'other';

const GAME_REASONS = new Set([
  'buy_in',
  'cash_out',
  'top_up',
  'hand_win',
  'hand_loss',
  'contest_prize',
  'offline_win',
]);

export function walletEntryMatchesSource(reason: string, source: WalletTrailSource): boolean {
  if (source === 'all') return true;
  return GAME_REASONS.has(reason) === (source === 'games');
}

export type WalletChartPoint = {
  t: number;
  balance: number;
  /** Absent for the synthetic range-start / now points. */
  point?: WalletBalancePoint;
};

export type WalletRangeSummary = {
  /** X domain. */
  from: number;
  to: number;
  chart: WalletChartPoint[];
  startBalance: number;
  endBalance: number;
  change: number;
  high: { balance: number; t: number };
  low: { balance: number; t: number };
};

/**
 * Balance line for a time window. `series` is oldest-first (see walletBalanceSeries).
 * When there is history before `since`, the line starts at the balance held then;
 * otherwise it starts at the first change, so a young account fills the chart. It
 * always ends at `now` on the latest balance.
 */
export function walletRangeSummary(
  series: readonly WalletBalancePoint[],
  opts: { since: number | null; now: number; currentBalance?: number | null },
): WalletRangeSummary | null {
  const { since, now } = opts;
  const before = since == null ? [] : series.filter((p) => p.entry.createdAt < since);
  const inRange = since == null ? series : series.filter((p) => p.entry.createdAt >= since);
  const prior = before[before.length - 1];
  const latest = inRange[inRange.length - 1] ?? prior;
  const endBalance =
    opts.currentBalance != null && Number.isFinite(opts.currentBalance)
      ? opts.currentBalance
      : latest?.balance;
  if (endBalance == null) return null;

  const first = inRange[0];
  const startBalance =
    prior?.balance ??
    (first
      ? first.entry.reason === 'opening_balance'
        ? first.balance
        : first.balance - first.entry.delta
      : endBalance);

  const from = prior && since != null ? since : (first?.entry.createdAt ?? since ?? now);
  const chart: WalletChartPoint[] = [];
  if (prior) chart.push({ t: from, balance: prior.balance });
  for (const p of inRange) chart.push({ t: p.entry.createdAt, balance: p.balance, point: p });
  chart.push({ t: Math.max(now, chart[chart.length - 1]?.t ?? now), balance: endBalance });
  if (chart.length === 1 && from < now) chart.unshift({ t: from, balance: endBalance });

  let high = { balance: chart[0]!.balance, t: chart[0]!.t };
  let low = { ...high };
  for (const c of chart) {
    if (c.balance > high.balance) high = { balance: c.balance, t: c.t };
    if (c.balance < low.balance) low = { balance: c.balance, t: c.t };
  }

  return {
    from: Math.min(from, chart[0]!.t),
    to: chart[chart.length - 1]!.t,
    chart,
    startBalance,
    endBalance,
    change: endBalance - startBalance,
    high,
    low,
  };
}

export type WalletActivityStats = {
  changes: number;
  gains: number;
  losses: number;
  earned: number;
  spent: number;
  net: number;
  biggestGain: WalletTrailEntry | null;
  biggestLoss: WalletTrailEntry | null;
  /** Most consecutive gains in time order. */
  bestStreak: number;
};

/** Totals for real balance changes (opening entries are skipped). */
export function walletActivityStats(entries: readonly WalletTrailEntry[]): WalletActivityStats {
  const stats: WalletActivityStats = {
    changes: 0,
    gains: 0,
    losses: 0,
    earned: 0,
    spent: 0,
    net: 0,
    biggestGain: null,
    biggestLoss: null,
    bestStreak: 0,
  };
  const chronological = entries
    .filter((e) => e.reason !== 'opening_balance' && e.delta !== 0)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);
  let streak = 0;
  for (const e of chronological) {
    stats.changes += 1;
    stats.net += e.delta;
    if (e.delta > 0) {
      stats.gains += 1;
      stats.earned += e.delta;
      if (!stats.biggestGain || e.delta > stats.biggestGain.delta) stats.biggestGain = e;
      streak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, streak);
    } else {
      stats.losses += 1;
      stats.spent += -e.delta;
      if (!stats.biggestLoss || e.delta < stats.biggestLoss.delta) stats.biggestLoss = e;
      streak = 0;
    }
  }
  return stats;
}
