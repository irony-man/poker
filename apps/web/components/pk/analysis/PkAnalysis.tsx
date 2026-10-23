'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  fetchAnalysisHands,
  fetchAnalysisTables,
  fetchMyHands,
  requestTableCoach,
  type AnalysisTableRow,
} from '@/lib/api';
import {
  adaptHandRows,
  adaptHandsToTables,
  filterTables,
  tableCardFromApi,
  type AdaptedTable,
} from '@/lib/pk/analysisAdapter';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';
import { useIsNarrow } from '@/lib/tableLayout';
import { PkBadge, PkEmpty, PkPageHeader, PkSkeleton, PkTabs } from '../Bits';
import { PkButton, PkLinkButton } from '../Button';
import { PkGate } from '../Gate';
import { PkDialog, PkSheet } from '../Overlay';
import { PkScope } from '../PkScope';
import { PlayingCard } from '@/components/PlayingCard';
import { cardLabel } from '@/lib/pk/cards';

const SAMPLE: AdaptedTable[] = [
  {
    tableId: 'sample',
    source: 'sample',
    opponents: 'bots',
    hands: 12,
    handsWon: 5,
    firstAt: Date.now() - 86_400_000,
    lastAt: Date.now(),
    label: 'Sample table',
    handIds: [],
  },
];

export function PkAnalysis({ tableId }: { tableId?: string }) {
  const { authReady, signedIn, sessionToken } = useLobbySession();
  const user = useSession((s) => s.userId);
  if (!authReady) {
    return (
      <PkScope>
        <p className="p-pk-6">Loading…</p>
      </PkScope>
    );
  }
  return (
    <PkScope>
      {tableId ? (
        <PkTableDetail tableId={tableId} signedIn={signedIn} sessionToken={sessionToken} userId={user} />
      ) : (
        <PkTableList signedIn={signedIn} sessionToken={sessionToken} userId={user} />
      )}
    </PkScope>
  );
}

function PkTableList({
  signedIn,
  sessionToken,
  userId,
}: {
  signedIn: boolean;
  sessionToken: string | null;
  userId: string | null;
}) {
  const search = useSearchParams();
  const router = useRouter();
  const narrow = useIsNarrow();
  const initial = search.get('type') === 'players' ? 'players' : 'all';
  const [filter, setFilter] = useState<'all' | 'players'>(initial);
  const [loading, setLoading] = useState(signedIn);
  const [tables, setTables] = useState<AdaptedTable[]>(signedIn ? [] : SAMPLE);
  const [gate, setGate] = useState(false);
  const [confirm, setConfirm] = useState<AdaptedTable | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn || !sessionToken || !userId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchAnalysisTables(sessionToken, filter === 'players' ? { opponents: 'players' } : {});
        if (cancelled) return;
        setTables(res.tables.map(tableCardFromApi));
      } catch {
        const hands = await fetchMyHands(sessionToken).catch(() => ({ hands: [] }));
        if (cancelled) return;
        setTables(filterTables(adaptHandsToTables(hands.hands, userId), filter === 'players' ? 'players' : 'all'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, sessionToken, userId, filter]);

  function select(next: 'all' | 'players') {
    setFilter(next);
    const params = new URLSearchParams(search.toString());
    if (next === 'players') params.set('type', 'players');
    else params.delete('type');
    const qs = params.toString();
    router.replace(qs ? `/analysis?${qs}` : '/analysis', { scroll: false });
  }

  const shown = signedIn ? tables : filter === 'players' ? [] : SAMPLE;

  return (
    <div className="mx-auto w-full max-w-4xl px-pk-4 py-pk-6">
      <PkPageHeader
        title="Analysis"
        subtitle="Tables you’ve played. Street-by-street review only shows cards the history already stored."
        actions={
          narrow ? (
            <PkButton variant="secondary" onClick={() => setFiltersOpen(true)}>
              Filters
            </PkButton>
          ) : null
        }
      />
      {!narrow ? (
        <PkTabs
          label="Analysis view"
          value={filter}
          onChange={(id) => select(id === 'players' ? 'players' : 'all')}
          options={[
            { id: 'all', label: 'All tables' },
            { id: 'players', label: 'Vs players' },
          ]}
        />
      ) : null}
      {!signedIn ? <PkBadge tone="free">Sample</PkBadge> : null}
      {loading ? (
        <div className="mt-pk-4 space-y-pk-3" aria-busy="true" aria-label="Loading analysis">
          <PkSkeleton className="h-24" />
          <PkSkeleton className="h-24" />
        </div>
      ) : shown.length === 0 ? (
        <PkEmpty
          title="No tables yet"
          body={filter === 'players' ? 'No tables with other players to show.' : 'Play a hand and it will show up here.'}
          action={<PkLinkButton href="/play">Host a table</PkLinkButton>}
        />
      ) : (
        <ul className="mt-pk-4 flex flex-col gap-pk-3">
          {shown.map((table) => (
            <li key={table.tableId} className="rounded-pk-lg border border-subtle/30 bg-panel p-pk-4 shadow-pk-sm">
              <div className="flex items-start justify-between gap-pk-3">
                <div>
                  <h2 className="font-pk-display text-pk-h4">{table.label}</h2>
                  <p className="text-pk-caption tabular-nums text-muted">
                    {table.handsWon}/{table.hands} hands won
                  </p>
                </div>
                <PkBadge tone={table.opponents === 'players' ? 'live' : 'neutral'}>{table.opponents}</PkBadge>
              </div>
              <div className="mt-pk-3 flex gap-pk-2">
                {table.tableId === 'sample' ? (
                  <PkButton onClick={() => setGate(true)}>Open</PkButton>
                ) : (
                  <PkLinkButton href={`/analysis/${encodeURIComponent(table.tableId)}`}>Open</PkLinkButton>
                )}
                <PkButton
                  variant="secondary"
                  onClick={() => {
                    if (!signedIn) setGate(true);
                    else setConfirm(table);
                  }}
                >
                  Analyse
                </PkButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {note ? <p className="mt-pk-3 text-pk-caption">{note}</p> : null}
      <PkSheet open={filtersOpen} title="Filters" onClose={() => setFiltersOpen(false)}>
        <PkTabs
          label="Analysis view"
          value={filter}
          onChange={(id) => {
            select(id === 'players' ? 'players' : 'all');
            setFiltersOpen(false);
          }}
          options={[
            { id: 'all', label: 'All tables' },
            { id: 'players', label: 'Vs players' },
          ]}
        />
      </PkSheet>
      <PkDialog open={confirm != null} title="Analyse this table?" onClose={() => setConfirm(null)}>
        <p className="text-pk-body-md text-muted">This uses your saved coaching review for the table.</p>
        <div className="mt-pk-4 flex justify-end gap-pk-2">
          <PkButton variant="ghost" onClick={() => setConfirm(null)}>
            Cancel
          </PkButton>
          <PkButton
            onClick={() => {
              const table = confirm;
              setConfirm(null);
              if (!table || !sessionToken) return;
              void requestTableCoach(sessionToken, table.tableId)
                .then(() => setNote('Analysis saved.'))
                .catch((err: unknown) => setNote(err instanceof Error ? err.message : 'Could not analyse'));
            }}
          >
            Analyse
          </PkButton>
        </div>
      </PkDialog>
      <PkGate
        open={gate}
        title="Sign in to see your hands"
        body="The sample table is a preview. Sign in to open your own history."
        next="/analysis"
        onClose={() => setGate(false)}
      />
    </div>
  );
}

function PkTableDetail({
  tableId,
  signedIn,
  sessionToken,
  userId,
}: {
  tableId: string;
  signedIn: boolean;
  sessionToken: string | null;
  userId: string | null;
}) {
  const search = useSearchParams();
  const handQuery = search.get('hand');
  const [rows, setRows] = useState<ReturnType<typeof adaptHandRows>>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<AnalysisTableRow | null>(null);

  useEffect(() => {
    if (!signedIn || !sessionToken || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [hands, tables] = await Promise.all([
          fetchAnalysisHands(sessionToken, { tableId }),
          fetchAnalysisTables(sessionToken),
        ]);
        if (cancelled) return;
        setRows(adaptHandRows(hands.hands, userId));
        setMeta(tables.tables.find((table) => table.tableId === tableId) ?? null);
      } catch {
        const hands = await fetchMyHands(sessionToken).catch(() => ({ hands: [] }));
        if (cancelled) return;
        setRows(adaptHandRows(hands.hands.filter((hand) => hand.tableId === tableId), userId));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, sessionToken, userId, tableId]);

  const selected =
    rows.find((hand) => hand.row.handId === handQuery) ??
    (handQuery ? rows[Number(handQuery) - 1] : undefined);

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-3xl px-pk-4 py-pk-6">
        <PkEmpty title="Sign in to review this table" body="Hand history is saved to your account." />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-pk-4 py-pk-6">
      <Link href="/analysis" className="text-pk-caption text-muted">
        All tables
      </Link>
      <PkPageHeader
        title={meta ? `${meta.hands} hands` : 'Table'}
        subtitle={meta ? `${meta.handsWon} won · ${meta.opponents}` : tableId}
      />
      {loading ? <PkSkeleton className="h-40" /> : null}
      {!loading && rows.length === 0 ? <PkEmpty title="No hands stored" body="This table has no saved hands yet." /> : null}
      <ul className="flex flex-col gap-pk-2">
        {rows.map((hand, index) => (
          <li key={hand.row.handId}>
            <Link
              href={`/analysis/${encodeURIComponent(tableId)}?hand=${index + 1}`}
              className="flex min-h-11 items-center justify-between rounded-pk-md bg-raised px-pk-3"
            >
              <span>Hand {index + 1}</span>
              <span className="tabular-nums">{hand.played.won ? 'Win' : 'Loss'}</span>
            </Link>
          </li>
        ))}
      </ul>
      {selected ? (
        <article className="mt-pk-6 rounded-pk-xl bg-panel p-pk-4 shadow-pk-md">
          <h2 className="font-pk-display text-pk-h3">{selected.played.won ? 'Win' : 'Loss'}</h2>
          <p className="text-pk-caption text-muted">{selected.played.handName ?? 'Showdown cards when they were saved'}</p>
          <div className="mt-pk-3 flex flex-wrap gap-pk-2">
            {(selected.played.holeCards ?? []).map((code) => (
              <span key={code} aria-label={cardLabel(code)}>
                <PlayingCard code={code} size="sm" />
              </span>
            ))}
          </div>
          <div className="mt-pk-3 flex flex-wrap gap-pk-1">
            {selected.played.community.map((code) => (
              <span key={code} aria-label={cardLabel(code)}>
                <PlayingCard code={code} size="xs" />
              </span>
            ))}
          </div>
          {selected.played.shownPlayers.length > 2 ? <PkBadge>Multi-way</PkBadge> : null}
        </article>
      ) : null}
    </div>
  );
}
