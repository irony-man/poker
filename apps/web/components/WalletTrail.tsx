'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WalletCurrency, WalletTrailEntry, WalletTrailPage } from '@poker/protocol';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { formatMoneyLabel } from '@/lib/currency';
import { cn } from '@/lib/cn';
import { walletEntryHref, walletReasonLabel } from '@/lib/walletTrail';

export type WalletTrailFetcher = (
  currency: WalletCurrency,
  before: string | null,
) => Promise<WalletTrailPage>;

const CURRENCY_OPTIONS = [
  { id: 'chips' as const, label: 'Chips' },
  { id: 'whuffies' as const, label: 'Whuffies' },
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

/**
 * Newest-first history of chip or Whuffie balance changes. Bump `refreshKey`
 * to reload from the top (e.g. after an admin adjustment).
 */
export function WalletTrail({
  fetchPage,
  initialCurrency = 'chips',
  onCurrencyChange,
  refreshKey = 0,
  idPrefix = 'wallet-trail',
  className,
}: {
  fetchPage: WalletTrailFetcher;
  initialCurrency?: WalletCurrency;
  onCurrencyChange?: (currency: WalletCurrency) => void;
  refreshKey?: string | number;
  idPrefix?: string;
  className?: string;
}) {
  const [currency, setCurrency] = useState<WalletCurrency>(initialCurrency);
  const [entries, setEntries] = useState<WalletTrailEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  useEffect(() => {
    setCurrency(initialCurrency);
  }, [initialCurrency]);

  useEffect(() => {
    const req = ++requestRef.current;
    setLoading(true);
    setError(null);
    setEntries([]);
    setNextCursor(null);
    fetchRef
      .current(currency, null)
      .then((page) => {
        if (req !== requestRef.current) return;
        setEntries(page.entries);
        setNextCursor(page.nextCursor);
      })
      .catch((err: unknown) => {
        if (req !== requestRef.current) return;
        setError(err instanceof Error ? err.message : 'Could not load history');
      })
      .finally(() => {
        if (req === requestRef.current) setLoading(false);
      });
  }, [currency, refreshKey]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const req = requestRef.current;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchRef.current(currency, nextCursor);
      if (req !== requestRef.current) return;
      setEntries((prev) => [...prev, ...page.entries]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (req !== requestRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load history');
    } finally {
      if (req === requestRef.current) setLoadingMore(false);
    }
  }, [currency, nextCursor, loadingMore]);

  const selectCurrency = (next: WalletCurrency) => {
    setCurrency(next);
    onCurrencyChange?.(next);
  };

  const panelId = `${idPrefix}-panel`;

  return (
    <div className={className}>
      <Tabs
        label="Currency"
        variant="pill"
        idPrefix={idPrefix}
        selected={currency}
        onSelect={selectCurrency}
        options={CURRENCY_OPTIONS.map((o) => ({ ...o, panelId }))}
      />
      <div id={panelId} role="tabpanel" aria-labelledby={`${idPrefix}-${currency}`} aria-busy={loading}>
        {loading ? (
          <p className="mt-5 text-sm text-muted" role="status">
            Loading history…
          </p>
        ) : entries.length === 0 && !error ? (
          <p className="mt-5 text-sm text-muted">No activity yet.</p>
        ) : entries.length > 0 ? (
          <ul className="surface-list mt-4">
            {entries.map((entry) => (
              <TrailRow key={entry.id} entry={entry} />
            ))}
          </ul>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {nextCursor && !loading ? (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
