import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { AdminContestRow, AdminTableRow } from '@/lib/api';
import { DataTable, EmptyState, Section, Subhead, Td, Th, THead, Tr } from '../ui';

function OpenLink({ href }: { href: string }) {
  return (
    <Link href={href} className="link-sidebar">
      Open
    </Link>
  );
}

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
        <Button variant="ghost" disabled={busy} onClick={onRefresh} className="min-h-9 px-4 text-xs">
          {busyKey === 'games' ? '…' : 'Refresh'}
        </Button>
      }
    >
      <div>
        <Subhead>Tables</Subhead>
        <DataTable
          minWidth="36rem"
          empty={tables.length === 0 ? <EmptyState>No live tables.</EmptyState> : null}
        >
          <THead>
            <Th>Name</Th>
            <Th>Seats</Th>
            <Th>Type</Th>
            <Th>Hand</Th>
            <Th>
              <span className="sr-only">Open</span>
            </Th>
          </THead>
          <tbody>
            {tables.map((t) => (
              <Tr key={t.tableId}>
                <Td className="font-medium text-ink-strong">{t.name}</Td>
                <Td className="tabular-nums text-ink-strong-muted">
                  {t.seatedCount}/{t.maxSeats}
                </Td>
                <Td className="text-ink-strong-muted">
                  {t.contestId ? 'Contest table' : t.playMoney ? 'Private (play)' : 'Private'}
                </Td>
                <Td className="text-ink-strong-muted">
                  {t.handInProgress ? (t.street ? t.street : 'In hand') : t.idle ? 'Idle' : 'Waiting'}
                </Td>
                <Td>
                  <OpenLink href={`/table/${t.tableId}?invite=${t.inviteCode}`} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <div>
        <Subhead>Contests</Subhead>
        <DataTable
          minWidth="36rem"
          empty={contests.length === 0 ? <EmptyState>No active contests.</EmptyState> : null}
        >
          <THead>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th>Field</Th>
            <Th>
              <span className="sr-only">Open</span>
            </Th>
          </THead>
          <tbody>
            {contests.map((c) => {
              const atTable = c.tableSeatedCount ?? null;
              const active = c.activePlayers ?? null;
              return (
                <Tr key={c.id}>
                  <Td className="font-medium text-ink-strong">
                    {c.name}
                    {c.isPrivate ? (
                      <span className="ml-1.5 text-xs font-normal text-ink-strong-muted">private</span>
                    ) : null}
                  </Td>
                  <Td className="capitalize text-ink-strong-muted">
                    {c.status} · {c.mode}
                  </Td>
                  <Td className="text-ink-strong-muted">
                    {c.entrants.length}/{c.fieldSize} registered
                    {active != null ? ` · ${active} still in` : ''}
                    {atTable != null && c.status === 'running' ? ` · ${atTable} at table` : ''}
                    {c.eliminatedCount ? ` · ${c.eliminatedCount} out` : ''}
                  </Td>
                  <Td>
                    <OpenLink href={`/contest/${c.id}`} />
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>
    </Section>
  );
}
