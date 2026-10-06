'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { WalletCurrency, WalletTrailEntry, WalletTrailPage } from '@poker/protocol';
import { ChipsImage, CurrencyIcon, MoneyAmount } from '@/components/CurrencyIcon';
import { WalletTrailChart } from '@/components/WalletTrailChart';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { formatMoneyLabel } from '@/lib/currency';
import { cn } from '@/lib/cn';
import {
  DEFAULT_WALLET_TRAIL_RANGE,
  DEFAULT_WALLET_TRAIL_VIEW,
  WALLET_TRAIL_RANGES,
  walletActivityStats,
  walletBalanceSeries,
  walletEntryHref,
  walletEntryMatchesSource,
  walletRangeSince,
  walletRangeSummary,
  walletReasonLabel,
  type WalletTrailRange,
  type WalletTrailSource,
  type WalletTrailView,
} from '@/lib/walletTrail';

export type WalletTrailFetcher = (
  currency: WalletCurrency,
  before: string | null,
  limit?: number,
) => Promise<WalletTrailPage>;

const PAGE_LIMIT = 100;
/** Pages fetched per automatic load; "Load older history" fetches another batch. */
const MAX_PAGES_PER_LOAD = 10;
const LIST_STEP = 30;

const CURRENCY_OPTIONS = [
  {
    id: 'chips' as const,
    label: (
      <>
        <ChipsImage className="!h-5 sm:!h-5" />
        Chips
      </>
    ),
  },
  {
    id: 'whuffies' as const,
    label: (
      <>
        <CurrencyIcon size={16} className="text-brass" />
        Whuffies
      </>
    ),
  },
];

const VIEW_OPTIONS = [
  { id: 'chart' as const, label: 'Chart' },
  { id: 'list' as const, label: 'List' },
];

const ICON_BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const SOURCE_OPTIONS = [
  { id: 'all' as const, label: 'All' },
  { id: 'games' as const, label: 'Games' },
  { id: 'other' as const, label: 'Other' },
];

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString()}`;
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—';
}

function TrailRow({ entry }: { entry: WalletTrailEntry }) {
  const href = walletEntryHref(entry);
  const label = walletReasonLabel(entry.reason, entry.currency);
  const positive = entry.delta >= 0;
  return (
    <li className="flex items-center justify-between gap-3 px-3.5 py-3 sm:px-4">
      <span className="min-w-0">
        <span className="block truncate font-medium text-primary">
          {href ? (
            <Link href={href} className="link-sidebar">
              {label}
            </Link>
          ) : (
            label
          )}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted">{formatWhen(entry.createdAt)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <MoneyAmount
          amount={Math.abs(entry.delta)}
          prefix={positive ? '+' : '−'}
          showWhuffies={entry.currency === 'whuffies'}
          className={cn('text-sm font-semibold', positive ? 'text-positive' : 'text-danger')}
        />
        {entry.balanceAfter != null ? (
          <span className="text-[11px] tabular-nums text-muted">
            Balance {formatMoneyLabel(entry.balanceAfter)}
          </span>
        ) : null}
      </span>
    </li>
  );
}

const RANGE_OPTIONS = WALLET_TRAIL_RANGES.map((r) => ({ value: r.id, label: r.label }));

const SMALL_ICON = { ...ICON_BASE, className: 'h-4 w-4' };

const CalendarIcon = () => (
  <svg {...SMALL_ICON} strokeWidth={2}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
const ListIcon = () => (
  <svg {...SMALL_ICON}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" />
  </svg>
);
const ChartIcon = () => (
  <svg {...SMALL_ICON}>
    <path d="M3 3v18h18" />
    <path d="m7 15 4-4 3 3 6-7" />
  </svg>
);

function ViewToggle({
  value,
  onChange,
  controls,
}: {
  value: WalletTrailView;
  onChange: (view: WalletTrailView) => void;
  controls: string;
}) {
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex shrink-0 rounded-xl border border-sidebar/15 bg-white p-0.5 shadow-sm"
    >
      {VIEW_OPTIONS.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={selected}
            aria-controls={controls}
            aria-label={`${o.label} view`}
            title={`${o.label} view`}
            onClick={() => onChange(o.id)}
            className={cn(
              'flex h-8 w-9 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar/30',
              selected
                ? 'bg-sidebar text-on-chrome shadow-sm'
                : 'text-sidebar/70 hover:bg-sidebar/[0.08] hover:text-sidebar',
            )}
          >
            {o.id === 'list' ? <ListIcon /> : <ChartIcon />}
          </button>
        );
      })}
    </div>
  );
}

function TileIcon({ kind }: { kind: 'changes' | 'gains' | 'losses' | 'net' }) {
  const box = cn(
    'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] text-[10px] font-black leading-none text-white',
    kind === 'gains' ? 'bg-positive' : kind === 'losses' ? 'bg-danger' : 'bg-sidebar/60',
  );
  return (
    <span className={box} aria-hidden>
      {kind === 'gains' ? '+' : kind === 'losses' ? '−' : kind === 'net' ? '=' : '#'}
    </span>
  );
}

function StatTile({
  kind,
  label,
  note,
  value,
  sub,
  valueClass,
}: {
  kind: 'changes' | 'gains' | 'losses' | 'net';
  label: string;
  note?: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col items-center px-2 py-3 text-center">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
        <TileIcon kind={kind} />
        {label}
        {note ? <span className="font-semibold normal-case tracking-normal">{note}</span> : null}
      </p>
      <p className={cn('mt-1 font-display text-3xl font-bold tabular-nums text-primary', valueClass)}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] tabular-nums text-muted">{sub}</p> : null}
    </div>
  );
}

function HighlightRow({
  icon,
  title,
  meta,
  value,
  valueClass,
}: {
  icon: ReactNode;
  title: string;
  meta?: ReactNode;
  value: string;
  valueClass?: string;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-sidebar/60" aria-hidden>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <span className="font-display text-base font-bold text-primary">{title}</span>
        {meta ? <span className="truncate text-xs text-muted">{meta}</span> : null}
      </span>
      <span className={cn('shrink-0 font-display text-base font-bold tabular-nums text-primary', valueClass)}>
        {value}
      </span>
    </li>
  );
}

const ICON_PROPS = { ...ICON_BASE, className: 'h-5 w-5' };

const ArrowUpIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M12 20V5M5 12l7-7 7 7" />
  </svg>
);
const ArrowDownIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M12 4v15M5 12l7 7 7-7" />
  </svg>
);
const MedalIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M8 3l2 6M16 3l-2 6" />
    <circle cx="12" cy="15" r="5" />
  </svg>
);
const FlameIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3 0-6 1-8.5Z" />
  </svg>
);

/**
 * Chip or Whuffie balance history with a time range, a balance chart, activity stats,
 * and a filterable list. Bump `refreshKey` to reload from the top (e.g. after an admin
 * adjustment). `balances` anchors the chart for older entries recorded without a balance.
 */
export function WalletTrail({
  fetchPage,
  initialCurrency = 'chips',
  onCurrencyChange,
  initialView = DEFAULT_WALLET_TRAIL_VIEW,
  onViewChange,
  initialRange = DEFAULT_WALLET_TRAIL_RANGE,
  onRangeChange,
  balances,
  refreshKey = 0,
  idPrefix = 'wallet-trail',
  className,
}: {
  fetchPage: WalletTrailFetcher;
  initialCurrency?: WalletCurrency;
  onCurrencyChange?: (currency: WalletCurrency) => void;
  initialView?: WalletTrailView;
  onViewChange?: (view: WalletTrailView) => void;
  initialRange?: WalletTrailRange;
  onRangeChange?: (range: WalletTrailRange) => void;
  balances?: Partial<Record<WalletCurrency, number>>;
  refreshKey?: string | number;
  idPrefix?: string;
  className?: string;
}) {
  const [currency, setCurrency] = useState<WalletCurrency>(initialCurrency);
  const [view, setView] = useState<WalletTrailView>(initialView);
  const [range, setRange] = useState<WalletTrailRange>(initialRange);
  const [source, setSource] = useState<WalletTrailSource>('all');
  const [entries, setEntries] = useState<WalletTrailEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listShown, setListShown] = useState(LIST_STEP);
  const requestRef = useRef(0);
  const loadedRef = useRef<{ entries: WalletTrailEntry[]; cursor: string | null }>({
    entries: [],
    cursor: null,
  });
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  useEffect(() => setCurrency(initialCurrency), [initialCurrency]);
  useEffect(() => setView(initialView), [initialView]);
  useEffect(() => setRange(initialRange), [initialRange]);
  useEffect(() => setListShown(LIST_STEP), [currency, range, source]);

  /** Fetch older pages until `since` is covered (null: until the batch runs out). */
  const extend = useCallback(
    async (req: number, cur: WalletCurrency, since: number | null) => {
      let { entries: acc, cursor } = loadedRef.current;
      for (let pages = 0; pages < MAX_PAGES_PER_LOAD; pages++) {
        if (acc.length > 0) {
          if (!cursor) break;
          if (since != null && acc[acc.length - 1]!.createdAt < since) break;
        }
        const page = await fetchRef.current(cur, cursor, PAGE_LIMIT);
        if (req !== requestRef.current) return;
        acc = [...acc, ...page.entries];
        cursor = page.nextCursor;
        loadedRef.current = { entries: acc, cursor };
        setEntries(acc);
        setNextCursor(cursor);
        if (!cursor) break;
      }
    },
    [],
  );

  const resetKey = `${currency}|${refreshKey}`;
  const lastResetKey = useRef<string | null>(null);
  /** Key the loaded entries belong to; differs for the render right after a currency switch. */
  const [entriesKey, setEntriesKey] = useState<string | null>(null);

  useEffect(() => {
    const reset = lastResetKey.current !== resetKey;
    lastResetKey.current = resetKey;
    setEntriesKey(resetKey);
    const req = ++requestRef.current;
    if (reset) {
      loadedRef.current = { entries: [], cursor: null };
      setEntries([]);
      setNextCursor(null);
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    extend(req, currency, walletRangeSince(range, Date.now()))
      .catch((err: unknown) => {
        if (req === requestRef.current) {
          setError(err instanceof Error ? err.message : 'Could not load history');
        }
      })
      .finally(() => {
        if (req === requestRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- currency is part of resetKey
  }, [resetKey, range, extend]);

  const loadOlder = () => {
    const req = ++requestRef.current;
    setLoadingMore(true);
    setError(null);
    extend(req, currency, null)
      .catch((err: unknown) => {
        if (req === requestRef.current) {
          setError(err instanceof Error ? err.message : 'Could not load history');
        }
      })
      .finally(() => {
        if (req === requestRef.current) setLoadingMore(false);
      });
  };

  const currentBalance = balances?.[currency];
  const now = useMemo(() => Date.now(), [entries, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const since = walletRangeSince(range, now);
  const rangeLabel = WALLET_TRAIL_RANGES.find((r) => r.id === range)?.label ?? '';

  const derived = useMemo(() => {
    const inRange = since == null ? entries : entries.filter((e) => e.createdAt >= since);
    const filtered = inRange.filter((e) => walletEntryMatchesSource(e.reason, source));
    const series = walletBalanceSeries(entries, currentBalance);
    return {
      filtered,
      stats: walletActivityStats(filtered),
      summary: walletRangeSummary(series, { since, now, currentBalance }),
    };
  }, [entries, since, now, source, currentBalance]);

  const oldest = entries[entries.length - 1];
  const truncated =
    nextCursor != null && (since == null || (oldest != null && oldest.createdAt >= since));

  const selectCurrency = (next: WalletCurrency) => {
    setCurrency(next);
    onCurrencyChange?.(next);
  };
  const selectView = (next: WalletTrailView) => {
    setView(next);
    onViewChange?.(next);
  };
  const selectRange = (next: WalletTrailRange) => {
    setRange(next);
    onRangeChange?.(next);
  };

  const panelId = `${idPrefix}-panel`;
  const { filtered, stats, summary } = derived;

  const sourceTabs = (
    <Tabs
      label="Activity type"
      variant="segmented"
      idPrefix={`${idPrefix}-source`}
      selected={source}
      onSelect={setSource}
      className="mx-auto w-full max-w-xs"
      options={SOURCE_OPTIONS}
    />
  );

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3 border-b border-sidebar/10">
        <Tabs
          label="Currency"
          variant="underline"
          idPrefix={idPrefix}
          selected={currency}
          onSelect={selectCurrency}
          className="-mb-px border-t-0"
          options={CURRENCY_OPTIONS.map((o) => ({ ...o, panelId }))}
        />
        <div className="mb-2 flex items-center gap-2">
          <Select
            size="sm"
            id={`${idPrefix}-range`}
            aria-label="Time range"
            icon={<CalendarIcon />}
            value={range}
            onChange={selectRange}
            options={RANGE_OPTIONS}
            className="w-auto min-w-[8.5rem]"
          />
          <ViewToggle value={view} onChange={selectView} controls={panelId} />
        </div>
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-${currency}`}
        aria-busy={loading || loadingMore}
      >
        {loading || entriesKey !== resetKey ? (
          <p className="mt-5 text-sm text-muted" role="status">
            Loading history…
          </p>
        ) : view === 'chart' ? (
          <div className="mt-4 flex flex-col gap-5">
            {summary ? (
              <WalletTrailChart summary={summary} currency={currency} rangeLabel={rangeLabel} />
            ) : (
              <p className="text-sm text-muted">No activity yet.</p>
            )}

            {summary ? (
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Highest', value: summary.high.balance },
                  { label: 'Lowest', value: summary.low.balance },
                  { label: 'Start of period', value: summary.startBalance },
                ].map((s) => (
                  <div key={s.label}>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      {s.label}
                    </dt>
                    <dd className="mt-0.5 font-display text-lg font-bold tabular-nums text-primary">
                      {s.value.toLocaleString()}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {sourceTabs}

            <div className="grid grid-cols-2 divide-sidebar/10 sm:grid-cols-4 sm:divide-x">
              <StatTile kind="changes" label="Changes" value={stats.changes.toLocaleString()} />
              <StatTile
                kind="gains"
                label="Gains"
                note={pct(stats.gains, stats.changes)}
                value={stats.gains.toLocaleString()}
                sub={stats.earned > 0 ? signed(stats.earned) : undefined}
              />
              <StatTile
                kind="losses"
                label="Losses"
                note={pct(stats.losses, stats.changes)}
                value={stats.losses.toLocaleString()}
                sub={stats.spent > 0 ? signed(-stats.spent) : undefined}
              />
              <StatTile
                kind="net"
                label="Net"
                value={signed(stats.net)}
                valueClass={
                  stats.net > 0 ? 'text-positive' : stats.net < 0 ? 'text-danger' : undefined
                }
              />
            </div>

            <section className="overflow-hidden rounded-xl border border-sidebar/[0.12]">
              <h4 className="px-4 pb-2 pt-3.5 font-display text-lg font-bold text-primary">
                Highlights
              </h4>
              <ul className="divide-y divide-sidebar/10 border-t border-sidebar/10">
                {summary ? (
                  <HighlightRow
                    icon={<ArrowUpIcon />}
                    title="Highest balance"
                    meta={formatDay(summary.high.t)}
                    value={summary.high.balance.toLocaleString()}
                  />
                ) : null}
                {stats.biggestGain ? (
                  <HighlightRow
                    icon={<MedalIcon />}
                    title="Biggest gain"
                    meta={walletReasonLabel(stats.biggestGain.reason, currency)}
                    value={signed(stats.biggestGain.delta)}
                    valueClass="text-positive"
                  />
                ) : null}
                {stats.biggestLoss ? (
                  <HighlightRow
                    icon={<ArrowDownIcon />}
                    title="Biggest loss"
                    meta={walletReasonLabel(stats.biggestLoss.reason, currency)}
                    value={signed(stats.biggestLoss.delta)}
                    valueClass="text-danger"
                  />
                ) : null}
                <HighlightRow
                  icon={<FlameIcon />}
                  title="Best gain streak"
                  value={stats.bestStreak.toLocaleString()}
                />
              </ul>
            </section>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {sourceTabs}
            {filtered.length === 0 ? (
              <p className="text-sm text-muted">
                {entries.length === 0 ? 'No activity yet.' : `No activity in the last ${rangeLabel}.`}
              </p>
            ) : (
              <>
                <ul className="surface-list">
                  {filtered.slice(0, listShown).map((entry) => (
                    <TrailRow key={entry.id} entry={entry} />
                  ))}
                </ul>
                {filtered.length > listShown ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setListShown((n) => n + LIST_STEP)}
                    >
                      Show more
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}

        {error ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && (truncated || loadingMore) ? (
          <div className="mt-4 flex flex-col items-center gap-1.5">
            {truncated ? (
              <p className="text-[11px] text-muted">
                Showing your latest {entries.length.toLocaleString()} changes.
              </p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadOlder}
              disabled={loadingMore || !truncated}
            >
              {loadingMore ? 'Loading…' : 'Load older history'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
