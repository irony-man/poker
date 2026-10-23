'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Tabs } from '@/components/ui/Tabs';
import { fetchAnalysisHands, fetchAnalysisTables, type AnalysisTableRow } from '@/lib/api';
import { InviteDialog } from '@/features/friends/InviteDialog';
import { formatHandWhen } from '@/features/progress/playedHand';
import {
  analysisTableHref,
  mergeTables,
  playersHeading,
  playersHeadingParts,
  tableLabel,
  toAnalysisRow,
  type AnalysisFilter,
  type AnalysisHandRow,
} from './analysisHand';
import { HandAnalysisCard } from './HandAnalysisCard';
import { CoachQuotaNote, TableCoach } from './TableCoach';

const HANDS_PAGE_SIZE = 20;
const TABLES_PAGE_SIZE = 20;

const FILTERS = [
  { id: 'all', label: 'All tables' },
  { id: 'bots', label: 'Vs bots' },
  { id: 'players', label: 'Vs players' },
] as const satisfies readonly { id: AnalysisFilter; label: string }[];

/** Drops responses from requests superseded by a newer one. */
function usePagedLoader<T>(
  fetchPage: (before?: number) => Promise<{ items: T[]; nextBefore: number | null }>,
  merge: (prev: T[], next: T[]) => T[] = (prev, next) => [...prev, ...next],
) {
  const [items, setItems] = useState<T[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const mergeRef = useRef(merge);
  mergeRef.current = merge;

  const load = useCallback(
    async (before?: number) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      if (before === undefined) {
        setItems([]);
        setNextBefore(null);
      }
      try {
        const res = await fetchPage(before);
        if (requestId !== requestIdRef.current) return;
        setItems((prev) => (before === undefined ? res.items : mergeRef.current(prev, res.items)));
        setNextBefore(res.nextBefore);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Could not load analysis');
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { items, nextBefore, loading, error, loadMore: () => nextBefore !== null && load(nextBefore) };
}

function LoadMore({
  loading,
  hasMore,
  label,
  onClick,
}: {
  loading: boolean;
  hasMore: boolean;
  label: string;
  onClick: () => void;
}) {
  if (loading) return <p className="mt-4 text-sm text-muted">Loading…</p>;
  if (!hasMore) return null;
  return (
    <div className="mt-5 flex justify-center">
      <Button variant="soft" onClick={onClick}>
        {label}
      </Button>
    </div>
  );
}

function EmptyState({ filter }: { filter: AnalysisFilter }) {
  return (
    <div className="rounded-2xl border border-dashed border-sidebar/20 bg-white p-6 text-center">
      <p className="font-semibold text-primary">
        {filter === 'players' ? 'No tables with players to analyse yet' : 'No tables to analyse yet'}
      </p>
      <p className="mt-1 text-sm text-muted">
        Every hand you play against bots is analysed. Hands against other players are analysed
        when they go to showdown and the cards are shown.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button href="/solo" variant="primary" size="sm">
          Play bots offline
        </Button>
        <Button href="/public" variant="soft" size="sm">
          Public tables
        </Button>
      </div>
    </div>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19v-1a4.5 4.5 0 0 1 4.5-4.5h2a4.5 4.5 0 0 1 4.5 4.5v1" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 14h.6a3.9 3.9 0 0 1 3.9 3.9V19" />
    </svg>
  );
}

function TablePlayersDialog({
  open,
  onClose,
  players,
}: {
  open: boolean;
  onClose: () => void;
  players: AnalysisTableRow['players'];
}) {
  const humans = players.filter((p) => !p.isBot).length;
  const bots = players.length - humans;
  const parts = [
    humans > 0 ? `${humans} ${humans === 1 ? 'player' : 'players'}` : null,
    bots > 0 ? `${bots} ${bots === 1 ? 'bot' : 'bots'}` : null,
  ].filter(Boolean);
  return (
    <InviteDialog
      open={open}
      onClose={onClose}
      icon={<PeopleIcon className="h-7 w-7" />}
      title="Players at this table"
      description={`You played against ${parts.join(' and ')} here.`}
    >
      <ul className="divide-y divide-sidebar/10 rounded-xl border border-sidebar/12">
        {players.map((p) => (
          <li key={p.userId} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="min-w-0 truncate text-sm font-semibold text-primary">{p.name}</span>
            <StatusChip tone={p.isBot ? 'muted' : 'neutral'} className="shrink-0 text-[10px]">
              {p.isBot ? 'Bot' : 'Player'}
            </StatusChip>
          </li>
        ))}
      </ul>
    </InviteDialog>
  );
}

function tableKind(table: AnalysisTableRow): string {
  if (table.source === 'offline') return 'Offline';
  return table.opponents === 'bots' ? 'Bots' : 'Players';
}

function TableRow({ table, filter }: { table: AnalysisTableRow; filter: AnalysisFilter }) {
  const first = formatHandWhen(table.firstAt);
  const last = formatHandWhen(table.lastAt);
  const names = table.players?.map((p) => p.name) ?? [];
  const heading = playersHeadingParts(names);
  const [playersOpen, setPlayersOpen] = useState(false);
  const when = last && last !== first ? `${first} – ${last}` : first;
  return (
    <li className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-sidebar/[0.03] sm:gap-4 sm:px-4">
      <div className="w-12 shrink-0 text-center">
        <p className="font-display text-lg font-bold leading-none tabular-nums text-sidebar">{table.hands}</p>
        <p className="mt-1 text-[10px] font-medium text-muted">{table.hands === 1 ? 'hand' : 'hands'}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h3
            className="min-w-0 truncate font-display text-sm font-bold text-sidebar"
            title={names.join(', ') || undefined}
          >
            {names.length > 0 ? heading.text : tableLabel(table)}
          </h3>
          {heading.more > 0 ? (
            <button
              type="button"
              onClick={() => setPlayersOpen(true)}
              className="link-sidebar shrink-0 text-xs font-bold"
              aria-haspopup="dialog"
            >
              +{heading.more}
            </button>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted">
          {when || 'Unknown time'}
          <span className={table.handsWon > 0 ? 'font-semibold text-positive' : ''}>
            {' '}
            · {table.handsWon} won
          </span>
        </p>
      </div>
      <TablePlayersDialog
        open={playersOpen}
        onClose={() => setPlayersOpen(false)}
        players={table.players ?? []}
      />
      {filter === 'all' ? (
        <span className="hidden shrink-0 rounded-full bg-sidebar/[0.06] px-2 py-0.5 text-[11px] font-medium text-muted sm:inline">
          {tableKind(table)}
        </span>
      ) : null}
      <Link
        href={analysisTableHref(table.tableId, !table.coached)}
        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold ${
          table.coached ? 'text-positive hover:bg-positive/10' : 'text-sidebar hover:bg-sidebar/[0.06]'
        }`}
      >
        {table.coached ? 'Analyzed' : 'Analyse'}
        {table.coached ? null : (
          <svg viewBox="0 0 20 20" aria-hidden className="h-3.5 w-3.5">
            <path
              d="M7.5 5 12.5 10 7.5 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </Link>
    </li>
  );
}

function TablesList({ sessionToken }: { sessionToken: string }) {
  const [filter, setFilter] = useState<AnalysisFilter>('all');
  const fetchPage = useCallback(
    async (before?: number) => {
      const res = await fetchAnalysisTables(sessionToken, {
        before,
        limit: TABLES_PAGE_SIZE,
        opponents: filter === 'all' ? undefined : filter,
      });
      return { items: res.tables, nextBefore: res.nextBefore };
    },
    [sessionToken, filter],
  );
  const { items, nextBefore, loading, error, loadMore } = usePagedLoader(fetchPage, mergeTables);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-end justify-between gap-3 border-b border-sidebar/10">
        <Tabs
          label="Filter tables"
          variant="underline"
          idPrefix="analysis-filter"
          selected={filter}
          options={FILTERS}
          onSelect={setFilter}
          className="-mb-px border-t-0"
        />
        <div className="mb-2 shrink-0">
          <CoachQuotaNote sessionToken={sessionToken} />
        </div>
      </div>
      {error ? (
        <StatusChip tone="danger" role="alert" className="mb-4 text-xs">
          {error}
        </StatusChip>
      ) : null}
      {!loading && items.length === 0 && !error ? <EmptyState filter={filter} /> : null}
      {items.length > 0 ? (
        <ul className="divide-y divide-sidebar/10 overflow-hidden rounded-2xl border border-sidebar/12 bg-white shadow-[0_4px_16px_rgb(var(--ds-brand-ink)_/_0.04)]">
          {items.map((t) => (
            <TableRow key={t.tableId} table={t} filter={filter} />
          ))}
        </ul>
      ) : null}
      <LoadMore
        loading={loading}
        hasMore={nextBefore !== null}
        label="Load more tables"
        onClick={() => void loadMore()}
      />
    </div>
  );
}

/** Breadcrumb label for a table, from its loaded hands (newest first). */
function tableTitle(hands: AnalysisHandRow[], userId: string): string | null {
  const oldest = hands[hands.length - 1];
  if (!oldest) return null;
  const names: string[] = [];
  for (const h of hands) {
    for (const p of h.result.players ?? []) {
      const name = typeof p?.name === 'string' ? p.name.trim() : '';
      if (p?.userId && p.userId !== userId && name && !names.includes(name)) names.push(name);
    }
  }
  const label =
    names.length > 0
      ? playersHeading(names)
      : tableLabel({
          source: oldest.row.source,
          opponents: hands.every((h) => h.vsBots) ? 'bots' : 'players',
        });
  const when = formatHandWhen(oldest.played.startedAt);
  return when ? `${label} · ${when}` : label;
}

function TableSummary({ hands }: { hands: AnalysisHandRow[] }) {
  const won = hands.filter((h) => h.played.won);
  const biggest = won.reduce((max, h) => Math.max(max, h.played.viewerWinAmount ?? 0), 0);
  const stats = [
    { label: 'Hands', value: <span>{hands.length}</span> },
    { label: 'Won', value: <span className="text-positive">{won.length}</span> },
    {
      label: 'Best pot',
      value:
        biggest > 0 ? (
          <MoneyAmount
            amount={biggest}
            showChips
            compact
            className="text-[1.05rem] sm:text-2xl"
            chipsClassName="!h-5 !w-auto sm:!h-5"
          />
        ) : (
          <>—</>
        ),
    },
  ];
  return (
    <section className="mb-4 rounded-2xl border border-sidebar/12 bg-white p-4 shadow-[0_4px_16px_rgb(var(--ds-brand-ink)_/_0.04)] sm:p-5">
      <h2 className="font-heading-section">Table summary</h2>
      <p className="mt-1 text-sm text-muted">Open a hand for the win chance and every bet.</p>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="min-w-0 rounded-xl bg-sidebar/[0.06] px-2.5 py-3 ring-1 ring-inset ring-sidebar/10 sm:px-3"
          >
            <dd className="truncate font-display text-xl font-bold tabular-nums leading-none text-sidebar sm:text-2xl">
              {s.value}
            </dd>
            <dt className="mt-2 text-[11px] font-medium leading-none text-muted">{s.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TableAnalysis({
  sessionToken,
  userId,
  tableId,
  since,
  requestCoach,
  onTitle,
}: {
  sessionToken: string;
  userId: string;
  tableId: string;
  since?: number;
  requestCoach: boolean;
  onTitle?: (title: string | null) => void;
}) {
  const fetchPage = useCallback(
    async (before?: number) => {
      const res = await fetchAnalysisHands(sessionToken, {
        tableId,
        since,
        before,
        limit: HANDS_PAGE_SIZE,
      });
      return { items: res.hands.map((row) => toAnalysisRow(row, userId)), nextBefore: res.nextBefore };
    },
    [sessionToken, userId, tableId, since],
  );
  const { items: hands, nextBefore, loading, error, loadMore } = usePagedLoader(fetchPage);
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const onReviews = useCallback((next: Record<string, string>) => {
    setReviews(next);
  }, []);
  const ordered = [...hands].sort((a, b) => a.played.startedAt - b.played.startedAt);
  const title = tableTitle(hands, userId);

  useEffect(() => {
    onTitle?.(title);
  }, [onTitle, title]);

  return (
    <div className="w-full mt-5">
      <TableCoach
        sessionToken={sessionToken}
        tableId={tableId}
        requestCoach={requestCoach}
        onReviews={onReviews}
      />
      <TableSummary hands={hands} />
      {error ? (
        <StatusChip tone="danger" role="alert" className="mb-4 text-xs">
          {error}
        </StatusChip>
      ) : null}
      {!loading && hands.length === 0 && !error ? (
        <p className="rounded-2xl border border-dashed border-sidebar/20 bg-white p-6 text-center text-sm text-muted">
          No hands at this table can be analysed. Hands against other players need a showdown.
        </p>
      ) : null}
      <LoadMore
        loading={loading}
        hasMore={nextBefore !== null}
        label="Load earlier hands"
        onClick={() => void loadMore()}
      />
      <ul className="space-y-3">
        {ordered.map((hand, i) => (
          <HandAnalysisCard
            key={hand.row.id}
            hand={hand}
            handNumber={i + 1}
            userId={userId}
            review={reviews[hand.row.handId]}
          />
        ))}
      </ul>
    </div>
  );
}

export function AnalysisPanel({
  sessionToken,
  userId,
  tableId,
  since,
  requestCoach = false,
  onTableTitle,
}: {
  sessionToken: string;
  userId: string;
  /** Analyse every hand at one table (also opened when a table ends). */
  tableId?: string;
  since?: number;
  /** Ask for a written review. Set when the user clicks Analyse table. */
  requestCoach?: boolean;
  /** Reports a readable table name once its hands load (for the breadcrumb). */
  onTableTitle?: (title: string | null) => void;
}) {
  if (tableId) {
    return (
      <TableAnalysis
        sessionToken={sessionToken}
        userId={userId}
        tableId={tableId}
        since={since}
        requestCoach={requestCoach}
        onTitle={onTableTitle}
      />
    );
  }
  return <TablesList sessionToken={sessionToken} />;
}
