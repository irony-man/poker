'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MoneyAmount } from '@/components/CurrencyIcon';
import {
  creditAdminUser,
  fetchAdminEconomy,
  fetchAdminGames,
  fetchAdminOverview,
  fetchAdminUsers,
  fetchMe,
  patchAdminAnnouncement,
  patchAdminEconomy,
  type AdminTableRow,
  type AdminUserRow,
  type ContestView,
  type SiteAnnouncement,
  type SiteEconomy,
} from '@/lib/api';
import { formatMoneyLabel } from '@/lib/currency';
import { readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-mushroom/15 bg-mushroom/[0.04] p-4 sm:p-5">
      <h2 className="font-display text-lg font-semibold uppercase tracking-[0.1em] text-ink-strong">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function AdminPageInner() {
  const { authReady, signedIn } = useLobbySession();
  const sessionToken = useSession((s) => s.sessionToken);
  const token = sessionToken ?? readStoredSession()?.sessionToken ?? null;

  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [announcement, setAnnouncement] = useState<SiteAnnouncement>({
    enabled: false,
    text: '',
  });
  const [economy, setEconomy] = useState<SiteEconomy>({
    startingChipGrant: 25000,
    refillThreshold: 1000,
    refillGrant: 5000,
  });
  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
  const [tables, setTables] = useState<AdminTableRow[]>([]);
  const [contests, setContests] = useState<ContestView[]>([]);
  const [stats, setStats] = useState<{ userCount: number; liveTables: number; liveContests: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const flash = useCallback((msg: string) => {
    setOkMsg(msg);
    setError(null);
    window.setTimeout(() => setOkMsg(null), 2500);
  }, []);

  const load = useCallback(async () => {
    if (!token) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const me = await fetchMe(token);
      if (!me.isAdmin) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      setIsAdmin(true);
      const [overview, eco, games, userList] = await Promise.all([
        fetchAdminOverview(token),
        fetchAdminEconomy(token),
        fetchAdminGames(token),
        fetchAdminUsers(token),
      ]);
      setAnnouncement(overview.announcement);
      setEconomy(eco);
      setStats({
        userCount: overview.userCount,
        liveTables: overview.liveTables,
        liveContests: overview.liveContests,
      });
      setTables(games.tables);
      setContests(games.contests);
      setUsers(userList.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin');
      setIsAdmin(false);
    } finally {
      setChecking(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const next = await patchAdminAnnouncement(token, announcement);
      setAnnouncement(next);
      flash('Announcement saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveEconomy(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const next = await patchAdminEconomy(token, {
        startingChipGrant: Math.floor(Number(economy.startingChipGrant)),
        refillThreshold: Math.floor(Number(economy.refillThreshold)),
        refillGrant: Math.floor(Number(economy.refillGrant)),
      });
      setEconomy(next);
      flash('Economy saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function searchUsers(e?: React.FormEvent) {
    e?.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchAdminUsers(token, userQuery);
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  async function topUp(userId: string) {
    if (!token) return;
    const raw = creditAmounts[userId] ?? '';
    const amount = Math.floor(Number(raw));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a positive top-up amount');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await creditAdminUser(token, userId, amount);
      flash(`Credited ${formatMoneyLabel(res.credited)} to ${res.username}`);
      setCreditAmounts((m) => ({ ...m, [userId]: '' }));
      await searchUsers();
      const overview = await fetchAdminOverview(token);
      setStats({
        userCount: overview.userCount,
        liveTables: overview.liveTables,
        liveContests: overview.liveContests,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Top-up failed');
    } finally {
      setBusy(false);
    }
  }

  async function refreshGames() {
    if (!token) return;
    setBusy(true);
    try {
      const games = await fetchAdminGames(token);
      setTables(games.tables);
      setContests(games.contests);
      const overview = await fetchAdminOverview(token);
      setStats({
        userCount: overview.userCount,
        liveTables: overview.liveTables,
        liveContests: overview.liveContests,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setBusy(false);
    }
  }

  if (!authReady || checking) {
    return <LoadingScreen label="Loading admin…" />;
  }

  if (!signedIn || !token) {
    return (
      <LobbyPageShell title="Admin" signedIn={false} requireAuth>
        <p className="text-sm text-ink-strong-muted">Sign in as an allowlisted admin.</p>
      </LobbyPageShell>
    );
  }

  if (!isAdmin) {
    return (
      <LobbyPageShell title="Admin" signedIn subtitle="Restricted">
        <p className="text-sm text-ink-strong-muted">
          You do not have admin access. Ask an operator to add your username to{' '}
          <code className="text-xs">ADMIN_USERNAMES</code>.
        </p>
      </LobbyPageShell>
    );
  }

  return (
    <LobbyPageShell
      title="Admin"
      subtitle={
        stats
          ? `${stats.userCount} users · ${stats.liveTables} tables · ${stats.liveContests} contests`
          : 'Site controls'
      }
      signedIn
      error={error}
    >
      {okMsg ? (
        <p className="mb-3 text-sm text-positive" role="status">
          {okMsg}
        </p>
      ) : null}

      <div className="flex flex-col gap-5">
        <Section title="Site text">
          <form onSubmit={(e) => void saveAnnouncement(e)} className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-ink-strong">
              <input
                type="checkbox"
                checked={announcement.enabled}
                onChange={(e) =>
                  setAnnouncement((a) => ({ ...a, enabled: e.target.checked }))
                }
              />
              Show banner on lobby pages
            </label>
            <textarea
              value={announcement.text}
              onChange={(e) => setAnnouncement((a) => ({ ...a, text: e.target.value }))}
              rows={3}
              maxLength={2000}
              className="w-full rounded-md border border-mushroom/20 bg-transparent px-3 py-2 text-sm text-ink-strong outline-none focus:border-mushroom/40"
              placeholder="Announcement shown above lobby content…"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[12rem]"
            >
              {busy ? 'Saving…' : 'Save site text'}
            </button>
          </form>
        </Section>

        <Section title="Sign-in / economy">
          <form onSubmit={(e) => void saveEconomy(e)} className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="text-ink-strong-muted">Starting grant</span>
              <input
                type="number"
                min={1}
                step={1}
                value={economy.startingChipGrant}
                onChange={(e) =>
                  setEconomy((eco) => ({
                    ...eco,
                    startingChipGrant: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-md border border-mushroom/20 bg-transparent px-3 py-2 text-sm tabular-nums text-ink-strong outline-none focus:border-mushroom/40"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-strong-muted">Refill threshold</span>
              <input
                type="number"
                min={1}
                step={1}
                value={economy.refillThreshold}
                onChange={(e) =>
                  setEconomy((eco) => ({
                    ...eco,
                    refillThreshold: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-md border border-mushroom/20 bg-transparent px-3 py-2 text-sm tabular-nums text-ink-strong outline-none focus:border-mushroom/40"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-strong-muted">Refill grant</span>
              <input
                type="number"
                min={1}
                step={1}
                value={economy.refillGrant}
                onChange={(e) =>
                  setEconomy((eco) => ({
                    ...eco,
                    refillGrant: Number(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-md border border-mushroom/20 bg-transparent px-3 py-2 text-sm tabular-nums text-ink-strong outline-none focus:border-mushroom/40"
              />
            </label>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md border border-mushroom/25 bg-mushroom/15 px-4 py-2 text-sm font-display font-semibold uppercase tracking-wider text-mushroom disabled:opacity-50"
              >
                Save economy
              </button>
            </div>
          </form>
        </Section>

        <Section title="Users & top-up">
          <form onSubmit={(e) => void searchUsers(e)} className="flex flex-wrap gap-2">
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search username…"
              className="min-w-[12rem] flex-1 rounded-md border border-mushroom/20 bg-transparent px-3 py-2 text-sm text-ink-strong outline-none focus:border-mushroom/40"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md border border-mushroom/25 px-4 py-2 text-sm font-medium text-ink-strong disabled:opacity-50"
            >
              Search
            </button>
          </form>
          <ul className="divide-y divide-mushroom/10">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-strong">{u.username}</p>
                  <p className="text-xs text-ink-strong-muted">
                    <MoneyAmount amount={u.chipBalance} showChips className="text-xs" />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    placeholder="Amount"
                    value={creditAmounts[u.id] ?? ''}
                    onChange={(e) =>
                      setCreditAmounts((m) => ({ ...m, [u.id]: e.target.value }))
                    }
                    className="w-28 rounded-md border border-mushroom/20 bg-transparent px-2 py-1.5 text-sm tabular-nums text-ink-strong outline-none focus:border-mushroom/40"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void topUp(u.id)}
                    className="rounded-md border border-positive/30 bg-positive/10 px-3 py-1.5 text-sm font-medium text-positive disabled:opacity-50"
                  >
                    Top up
                  </button>
                </div>
              </li>
            ))}
            {users.length === 0 ? (
              <li className="py-3 text-sm text-ink-strong-muted">No users match.</li>
            ) : null}
          </ul>
        </Section>

        <Section title="Active games">
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => void refreshGames()}
              className="rounded-md border border-mushroom/25 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-ink-strong disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink-strong-muted">Tables</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-mushroom/15 text-xs uppercase tracking-wider text-ink-strong-muted">
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Seats</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Hand</th>
                    <th className="py-2">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t) => (
                    <tr key={t.tableId} className="border-b border-mushroom/8">
                      <td className="py-2 pr-2 text-ink-strong">{t.name}</td>
                      <td className="py-2 pr-2 tabular-nums text-ink-strong-muted">
                        {t.seatedCount}/{t.maxSeats}
                      </td>
                      <td className="py-2 pr-2 text-ink-strong-muted">
                        {t.contestId
                          ? 'Contest'
                          : t.isPrivate
                            ? t.playMoney
                              ? 'Private (play)'
                              : 'Private'
                            : t.stakeId ?? 'Public'}
                      </td>
                      <td className="py-2 pr-2 text-ink-strong-muted">
                        {t.handInProgress ? 'Active' : t.idle ? 'Idle' : 'Waiting'}
                      </td>
                      <td className="py-2">
                        <Link
                          href={`/table/${t.tableId}?invite=${t.inviteCode}`}
                          className="text-brass underline-offset-2 hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tables.length === 0 ? (
                <p className="py-2 text-sm text-ink-strong-muted">No live tables.</p>
              ) : null}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-ink-strong-muted">Contests</h3>
            <ul className="space-y-2">
              {contests.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-mushroom/8 py-2 text-sm"
                >
                  <span className="text-ink-strong">
                    {c.name}{' '}
                    <span className="text-ink-strong-muted">
                      · {c.status} · {c.entrants.length}/{c.fieldSize}
                      {c.isPrivate ? ' · private' : ''}
                    </span>
                  </span>
                  <Link
                    href={`/contest/${c.id}`}
                    className="text-brass underline-offset-2 hover:underline"
                  >
                    Open
                  </Link>
                </li>
              ))}
              {contests.length === 0 ? (
                <li className="text-sm text-ink-strong-muted">No contests.</li>
              ) : null}
            </ul>
          </div>
        </Section>
      </div>
    </LobbyPageShell>
  );
}

export default function AdminPage() {
  return <AdminPageInner />;
}
