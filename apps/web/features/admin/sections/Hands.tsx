'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PlayingCard } from '@/components/PlayingCard';
import { fetchAdminHand, fetchAdminHands, type AdminHandSummary } from '@/lib/api';
import { formatMoneyAmount } from '@/lib/currency';
import { DataTable, EmptyState, SaveBar, Section, Subhead, Td, Th, THead, Tr } from '../ui';

const RANK_CHAR: Record<number, string> = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
  10: 'T',
  9: '9',
  8: '8',
  7: '7',
  6: '6',
  5: '5',
  4: '4',
  3: '3',
  2: '2',
};

function cardCode(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.length >= 2) return raw;
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as { rank?: unknown; suit?: unknown };
  const suit = typeof rec.suit === 'string' ? rec.suit : null;
  if (!suit) return null;
  if (typeof rec.rank === 'number' && RANK_CHAR[rec.rank]) {
    return `${RANK_CHAR[rec.rank]}${suit}`;
  }
  if (typeof rec.rank === 'string') return `${rec.rank}${suit}`;
  return null;
}

function cardCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(cardCode).filter((c): c is string => !!c);
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function winnerLine(hand: AdminHandSummary): string {
  if (hand.winners.length === 0) return '—';
  return hand.winners
    .map((w) => {
      const name = w.name ?? `Seat ${w.seat}`;
      const amt = formatMoneyAmount(w.amount);
      return w.handName && w.handName !== 'Uncontested' ? `${name} ${amt} (${w.handName})` : `${name} ${amt}`;
    })
    .join(', ');
}

type HandPlayer = {
  seat: number;
  name: string;
  holeCards: string[];
  revealed: boolean;
};

type HandAction = {
  type?: string;
  action?: string;
  amount?: number;
  street?: string;
  seat?: number;
  sb?: number;
  bb?: number;
  sbSeat?: number;
  bbSeat?: number;
};

type HandDetail = {
  actions: HandAction[];
  community: string[];
  players: HandPlayer[];
  winnerSeats: number[];
};

function playerName(players: HandPlayer[], seat: number | undefined): string {
  if (typeof seat !== 'number') return 'Unknown';
  return players.find((p) => p.seat === seat)?.name ?? `Seat ${seat}`;
}

function formatPlayerAction(
  action: string | undefined,
  amount: number | undefined,
): string {
  const amt = typeof amount === 'number' && amount > 0 ? formatMoneyAmount(amount) : null;
  switch (action) {
    case 'fold':
      return 'folds';
    case 'check':
      return 'checks';
    case 'call':
      return amt ? `calls ${amt}` : 'calls';
    case 'bet':
      return amt ? `bets ${amt}` : 'bets';
    case 'raise':
      return amt ? `raises to ${amt}` : 'raises';
    case 'allin':
      return amt ? `goes all-in (${amt})` : 'goes all-in';
    default:
      return action ?? 'acts';
  }
}

type ActionLine = { street: string; name: string; verb: string };

function actionLines(actions: HandAction[], players: HandPlayer[]): ActionLine[] {
  const lines: ActionLine[] = [];
  let street = 'Preflop';
  for (const a of actions) {
    if (a.type === 'street' && typeof a.street === 'string') {
      street = a.street.charAt(0).toUpperCase() + a.street.slice(1);
      continue;
    }
    if (a.type === 'blinds_posted') {
      const sbAmt = typeof a.sb === 'number' ? formatMoneyAmount(a.sb) : '';
      const bbAmt = typeof a.bb === 'number' ? formatMoneyAmount(a.bb) : '';
      lines.push({
        street: 'Preflop',
        name: playerName(players, a.sbSeat),
        verb: sbAmt ? `posts small blind ${sbAmt}` : 'posts small blind',
      });
      lines.push({
        street: 'Preflop',
        name: playerName(players, a.bbSeat),
        verb: bbAmt ? `posts big blind ${bbAmt}` : 'posts big blind',
      });
      continue;
    }
    if (a.type !== 'action') continue;
    lines.push({
      street,
      name: playerName(players, a.seat),
      verb: formatPlayerAction(a.action, a.amount),
    });
  }
  return lines;
}

function ActionLog({ actions, players }: { actions: HandAction[]; players: HandPlayer[] }) {
  const lines = actionLines(actions, players);
  if (lines.length === 0) {
    return <p className="text-xs text-ink-strong-muted">No action log</p>;
  }
  const groups: { street: string; lines: ActionLine[] }[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.street === line.street) last.lines.push(line);
    else groups.push({ street: line.street, lines: [line] });
  }
  return (
    <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-ink-strong">
      {groups.map((group) => (
        <Fragment key={group.street}>
          <li className="pt-1.5 text-[10px] font-display font-semibold uppercase tracking-[0.14em] text-ink-strong-muted first:pt-0">
            {group.street}
          </li>
          {group.lines.map((line, i) => (
            <li key={`${group.street}-${i}`}>
              <span className="font-medium">{line.name}</span> {line.verb}
            </li>
          ))}
        </Fragment>
      ))}
    </ul>
  );
}

function CardRow({ codes, highlight }: { codes: string[]; highlight?: boolean }) {
  if (codes.length === 0) {
    return <span className="text-xs text-ink-strong-muted">—</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {codes.map((code, i) => (
        <PlayingCard key={`${code}-${i}`} code={code} size="xs" highlight={highlight} dealDelay={0} />
      ))}
    </div>
  );
}

export function HandsSection({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<AdminHandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HandDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminHands(token, { page: nextPage, pageSize });
        setItems(data.items);
        setTotal(data.total);
        setPage(data.page);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load hands');
      } finally {
        setLoading(false);
      }
    },
    [token, pageSize],
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const toggleExpand = async (hand: AdminHandSummary) => {
    if (expandedId === hand.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(hand.id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await fetchAdminHand(token, hand.id);
      const result = (data.hand.result ?? null) as {
        actions?: unknown;
        community?: unknown;
        players?: unknown;
        winners?: unknown;
      } | null;
      const actions = Array.isArray(result?.actions) ? result.actions : [];
      const playersRaw = Array.isArray(result?.players) ? result.players : [];
      const players: HandPlayer[] = playersRaw.flatMap((p) => {
        if (!p || typeof p !== 'object') return [];
        const rec = p as {
          seat?: unknown;
          name?: unknown;
          holeCards?: unknown;
          revealed?: unknown;
          userId?: unknown;
        };
        if (typeof rec.seat !== 'number') return [];
        if (!rec.userId && !rec.name) return [];
        return [
          {
            seat: rec.seat,
            name: typeof rec.name === 'string' && rec.name ? rec.name : `Seat ${rec.seat}`,
            holeCards: cardCodes(rec.holeCards),
            revealed: rec.revealed === true,
          },
        ];
      });
      const winnersRaw = Array.isArray(result?.winners) ? result.winners : [];
      const winnerSeats = winnersRaw.flatMap((w) =>
        w && typeof w === 'object' && typeof (w as { seat?: unknown }).seat === 'number'
          ? [(w as { seat: number }).seat]
          : [],
      );
      setDetail({
        actions: actions as HandAction[],
        community: cardCodes(result?.community),
        players,
        winnerSeats,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load hand');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <Section
      title="Hands"
      description="Completed hands across cash, contest, and solo tables."
      action={
        <Button
          variant="ghost"
          disabled={loading}
          onClick={() => void load(page)}
          className="min-h-9 px-4 text-xs"
        >
          {loading ? '…' : 'Refresh'}
        </Button>
      }
    >
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <DataTable
        minWidth="44rem"
        empty={items.length === 0 && !loading ? <EmptyState>No hands recorded yet.</EmptyState> : null}
      >
        <THead>
          <Th>When</Th>
          <Th>Source</Th>
          <Th>Table</Th>
          <Th>Players</Th>
          <Th>Winner</Th>
        </THead>
        <tbody>
          {items.map((hand) => (
            <Fragment key={hand.id}>
              <Tr onClick={() => void toggleExpand(hand)}>
                <Td className="tabular-nums text-ink-strong-muted">{formatWhen(hand.startedAt)}</Td>
                <Td className="capitalize text-ink-strong-muted">{hand.source}</Td>
                <Td className="font-mono text-xs text-ink-strong">
                  {hand.tableId}
                  {hand.contestId ? (
                    <span className="mt-0.5 block text-[10px] text-ink-strong-muted">
                      Contest {hand.contestId}
                    </span>
                  ) : null}
                </Td>
                <Td className="text-ink-strong-muted">{hand.playerNames.join(', ') || '—'}</Td>
                <Td className="text-ink-strong">{winnerLine(hand)}</Td>
              </Tr>
              {expandedId === hand.id ? (
                <tr className="border-b border-sidebar/6 bg-mushroom/20">
                  <Td colSpan={5} className="px-3 py-3">
                    {detailLoading ? (
                      <p className="text-sm text-ink-strong-muted">Loading…</p>
                    ) : detail ? (
                      <div className="space-y-4">
                        <div>
                          <Subhead>Board</Subhead>
                          <CardRow codes={detail.community} />
                        </div>
                        <div>
                          <Subhead>Hands</Subhead>
                          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {detail.players.length === 0 ? (
                              <li className="text-xs text-ink-strong-muted">No player cards saved</li>
                            ) : (
                              detail.players.map((p) => {
                                const won = detail.winnerSeats.includes(p.seat);
                                return (
                                  <li
                                    key={p.seat}
                                    className="flex items-center gap-3 rounded-lg border border-sidebar/10 bg-cream/80 px-3 py-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-ink-strong">
                                        {p.name}
                                        {won ? (
                                          <span className="ml-1.5 text-[10px] font-display font-semibold uppercase tracking-[0.12em] text-sidebar">
                                            Win
                                          </span>
                                        ) : null}
                                      </p>
                                      <p className="text-[10px] text-ink-strong-muted">Seat {p.seat}</p>
                                    </div>
                                    <CardRow codes={p.holeCards} highlight={won} />
                                  </li>
                                );
                              })
                            )}
                          </ul>
                        </div>
                        <div>
                          <Subhead>Actions</Subhead>
                          <ActionLog actions={detail.actions} players={detail.players} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-strong-muted">No detail</p>
                    )}
                  </Td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </DataTable>
      <SaveBar
        hint={total === 0 ? '0 hands' : `Page ${page} of ${pageCount} · ${total} hands`}
      >
        <Button
          variant="ghost"
          className="min-h-9 px-3 text-xs"
          disabled={loading || page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </Button>
        <Button
          variant="ghost"
          className="min-h-9 px-3 text-xs"
          disabled={loading || page >= pageCount}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </SaveBar>
    </Section>
  );
}
