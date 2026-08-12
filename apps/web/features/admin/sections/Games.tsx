import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { AdminContestRow, AdminTableRow } from '@/lib/api';
import { Section } from '../ui';

export function GamesSection({
  tables,
  contests,
  busy,
  busyKey,
  onRefresh,
}: {
  tables: AdminTableRow[];
  contests: AdminContestRow[];
  busy: boolean;
  busyKey: string | null;
  onRefresh: () => void;
}) {
  return (
    <Section
      title="Live games"
      description="Private tables and active contests on this server. Permanent public stake lobbies and finished contests are omitted."
      action={
        <Button
          variant="ghost"
          disabled={busy}
          onClick={onRefresh}
          className="min-h-9 px-4 text-xs"
        >
          {busyKey === 'games' ? '…' : 'Refresh'}
        </Button>
      }
    >
      <div>
        <h3 className="mb-2 text-xs font-display font-semibold uppercase tracking-[0.14em] text-ink-strong-muted">
          Tables
        </h3>
        <div className="overflow-x-auto rounded-xl border border-sidebar/10">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-sidebar/10 bg-mushroom/[0.05] text-[10px] font-display font-semibold uppercase tracking-[0.14em] text-ink-strong-muted">
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Seats</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Hand</th>
                <th className="px-3 py-2.5"> </th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t.tableId} className="border-b border-sidebar/6">
                  <td className="px-3 py-2.5 font-medium text-ink-strong">{t.name}</td>
                  <td className="px-3 py-2.5 tabular-nums text-ink-strong-muted">
                    {t.seatedCount}/{t.maxSeats}
                  </td>
                  <td className="px-3 py-2.5 text-ink-strong-muted">
                    {t.contestId ? 'Contest table' : t.playMoney ? 'Private (play)' : 'Private'}
                  </td>
                  <td className="px-3 py-2.5 text-ink-strong-muted">
                    {t.handInProgress
                      ? t.street
                        ? t.street
                        : 'In hand'
                      : t.idle
                        ? 'Idle'
                        : 'Waiting'}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/table/${t.tableId}?invite=${t.inviteCode}`}
                      className="font-medium text-sidebar underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tables.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-strong-muted">No live tables.</p>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-display font-semibold uppercase tracking-[0.14em] text-ink-strong-muted">
          Contests
        </h3>
        <ul className="overflow-hidden rounded-xl border border-sidebar/10">
          {contests.map((c) => {
            const atTable = c.tableSeatedCount ?? null;
            const active = c.activePlayers ?? null;
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-sidebar/6 px-3 py-2.5 text-sm last:border-0"
              >
                <span className="text-ink-strong">
                  <span className="font-medium">{c.name}</span>{' '}
                  <span className="text-ink-strong-muted">
                    · {c.status} · {c.mode}
                    {c.isPrivate ? ' · private' : ''}
                    <br className="sm:hidden" />
                    <span className="sm:before:content-['·_']">
                      {c.entrants.length}/{c.fieldSize} registered
                      {active != null ? ` · ${active} still in` : ''}
                      {atTable != null && c.status === 'running' ? ` · ${atTable} at table` : ''}
                      {c.eliminatedCount ? ` · ${c.eliminatedCount} out` : ''}
                    </span>
                  </span>
                </span>
                <Link
                  href={`/contest/${c.id}`}
                  className="font-medium text-sidebar underline-offset-2 hover:underline"
                >
                  Open
                </Link>
              </li>
            );
          })}
          {contests.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-strong-muted">
              No active contests.
            </li>
          ) : null}
        </ul>
      </div>
    </Section>
  );
}
