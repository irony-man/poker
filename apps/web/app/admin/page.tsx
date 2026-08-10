'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MoneyAmount } from '@/components/CurrencyIcon';
import { useConfirm } from '@/components/ConfirmPopover';
import {
  creditAdminUser,
  fetchAdminEconomy,
  fetchAdminGames,
  fetchAdminHomeFeatures,
  fetchAdminOverview,
  fetchAdminPages,
  fetchAdminRoomSettings,
  fetchAdminUsers,
  fetchMe,
  patchAdminAnnouncement,
  patchAdminEconomy,
  patchAdminHomeFeatures,
  patchAdminPages,
  patchAdminRoomSettings,
  resetAdminUserChips,
  type AdminRoomSettings,
  type AdminTableRow,
  type AdminUserRow,
  type ContestView,
  type HomeLandingFeature,
  type SiteAnnouncement,
  type SiteEconomy,
} from '@/lib/api';
import { formatMoneyLabel } from '@/lib/currency';
import { DEFAULT_HOME_FEATURES } from '@/components/HomeLanding';
import {
  clonePagesCopy,
  DEFAULT_PAGES_COPY,
  PAGE_COPY_KEYS,
  PAGE_COPY_LABELS,
  type PagesCopy,
} from '@/lib/pageCopy';
import { readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';

const MAX_HOME_BLOCKS = 12;

const BLANK_HOME_BLOCK: HomeLandingFeature = {
  title: 'New feature',
  body: 'Describe this feature for players landing on the home page.',
  cta: 'Learn more',
  href: '/',
  image: '/home-host.png',
  imageAlt: 'POKR feature illustration',
  imageFirst: true,
};

const fieldClass =
  'mt-1.5 w-full rounded-lg border border-sidebar/15 bg-cream px-3 py-2.5 text-sm text-ink-strong shadow-sm outline-none transition placeholder:text-ink-strong-muted/50 focus:border-sidebar/40 focus:ring-2 focus:ring-sidebar/10';

const labelClass = 'block text-xs font-display font-semibold uppercase tracking-[0.12em] text-ink-strong-muted';

type AdminTab = 'users' | 'content' | 'home' | 'pages' | 'economy' | 'games';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'content', label: 'Banner' },
  { id: 'home', label: 'Home page' },
  { id: 'pages', label: 'Pages' },
  { id: 'economy', label: 'Economy' },
  { id: 'games', label: 'Live games' },
];

function Section({
  id,
  title,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-sidebar/10 bg-cream/90 p-4 shadow-[0_8px_28px_rgb(29_4_50/0.06)] sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-sidebar/8 pb-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.12em] text-ink-strong">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-strong-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[7.5rem] flex-1 rounded-xl border border-sidebar/10 bg-cream px-4 py-3 shadow-sm">
      <p className="text-[10px] font-display font-semibold uppercase tracking-[0.16em] text-ink-strong-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-sidebar">{value}</p>
    </div>
  );
}

function AdminPageInner() {
  const { authReady, signedIn } = useLobbySession();
  const confirm = useConfirm();
  const sessionToken = useSession((s) => s.sessionToken);
  const token = sessionToken ?? readStoredSession()?.sessionToken ?? null;
  const navId = useId();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>('users');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [announcement, setAnnouncement] = useState<SiteAnnouncement>({
    enabled: false,
    text: '',
  });
  const [economy, setEconomy] = useState<SiteEconomy>({
    startingChipGrant: 25000,
    refillThreshold: 1000,
    refillGrant: 5000,
  });
  const [roomSettings, setRoomSettings] = useState<AdminRoomSettings>({
    inactivityMinutes: 15,
  });
  const [homeFeatures, setHomeFeatures] = useState<HomeLandingFeature[]>(
    () => DEFAULT_HOME_FEATURES.map((f) => ({ ...f })),
  );
  const [pagesCopy, setPagesCopy] = useState<PagesCopy>(() => clonePagesCopy());
  const [openBlocks, setOpenBlocks] = useState<Record<number, boolean>>({ 0: true });
  const [openPage, setOpenPage] = useState<string | null>('host');
  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
  const [tables, setTables] = useState<AdminTableRow[]>([]);
  const [contests, setContests] = useState<ContestView[]>([]);
  const [stats, setStats] = useState<{ userCount: number; liveTables: number; liveContests: number } | null>(
    null,
  );

  const busy = busyKey !== null;

  const flash = useCallback((msg: string) => {
    setOkMsg(msg);
    setError(null);
    window.setTimeout(() => setOkMsg(null), 2800);
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
      const [overview, eco, games, userList, home, pages, rooms] = await Promise.all([
        fetchAdminOverview(token),
        fetchAdminEconomy(token),
        fetchAdminGames(token),
        fetchAdminUsers(token),
        fetchAdminHomeFeatures(token),
        fetchAdminPages(token),
        fetchAdminRoomSettings(token),
      ]);
      setAnnouncement(overview.announcement);
      setEconomy(eco);
      setRoomSettings(rooms);
      setHomeFeatures(
        home.features?.length
          ? home.features
          : DEFAULT_HOME_FEATURES.map((f) => ({ ...f })),
      );
      setPagesCopy(pages.pages ? clonePagesCopy(pages.pages) : clonePagesCopy());
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

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusyKey(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusyKey(null);
    }
  }

  async function saveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await withBusy('announce', async () => {
      const next = await patchAdminAnnouncement(token, announcement);
      setAnnouncement(next);
      flash('Site banner saved');
    });
  }

  async function saveEconomy(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await withBusy('economy', async () => {
      const [nextEco, nextRooms] = await Promise.all([
        patchAdminEconomy(token, {
          startingChipGrant: Math.floor(Number(economy.startingChipGrant)),
          refillThreshold: Math.floor(Number(economy.refillThreshold)),
          refillGrant: Math.floor(Number(economy.refillGrant)),
        }),
        patchAdminRoomSettings(token, {
          inactivityMinutes: Math.floor(Number(roomSettings.inactivityMinutes)),
        }),
      ]);
      setEconomy(nextEco);
      setRoomSettings(nextRooms);
      flash('Economy & room settings saved');
    });
  }

  async function saveHomeFeatures(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await withBusy('home', async () => {
      const res = await patchAdminHomeFeatures(token, homeFeatures);
      setHomeFeatures(res.features);
      flash('Home landing saved');
    });
  }

  async function savePages(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await withBusy('pages', async () => {
      const res = await patchAdminPages(token, pagesCopy);
      setPagesCopy(clonePagesCopy(res.pages));
      flash('Page text saved');
    });
  }

  function updateHomeFeature(index: number, patch: Partial<HomeLandingFeature>) {
    setHomeFeatures((list) =>
      list.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  }

  function addHomeFeature() {
    setHomeFeatures((list) => {
      if (list.length >= MAX_HOME_BLOCKS) return list;
      const next = [...list, { ...BLANK_HOME_BLOCK }];
      setOpenBlocks((m) => ({ ...m, [next.length - 1]: true }));
      return next;
    });
  }

  function removeHomeFeature(index: number) {
    setHomeFeatures((list) => {
      if (list.length <= 1) return list;
      return list.filter((_, i) => i !== index);
    });
    setOpenBlocks({});
  }

  function moveHomeFeature(index: number, dir: -1 | 1) {
    setHomeFeatures((list) => {
      const j = index + dir;
      if (j < 0 || j >= list.length) return list;
      const next = list.slice();
      const tmp = next[index]!;
      next[index] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }

  async function searchUsers(e?: React.FormEvent) {
    e?.preventDefault();
    if (!token) return;
    await withBusy('users-search', async () => {
      const res = await fetchAdminUsers(token, userQuery);
      setUsers(res.users);
    });
  }

  async function topUp(userId: string) {
    if (!token) return;
    const raw = creditAmounts[userId] ?? '';
    const amount = Math.floor(Number(raw));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a positive top-up amount');
      return;
    }
    await withBusy(`topup-${userId}`, async () => {
      const res = await creditAdminUser(token, userId, amount);
      flash(`Credited ${formatMoneyLabel(res.credited)} to ${res.username}`);
      setCreditAmounts((m) => ({ ...m, [userId]: '' }));
      const list = await fetchAdminUsers(token, userQuery);
      setUsers(list.users);
    });
  }

  async function resetChips(user: AdminUserRow) {
    if (!token) return;
    const grant = formatMoneyLabel(economy.startingChipGrant);
    const ok = await confirm({
      title: `Reset ${user.username}?`,
      description: `Set their bankroll to the starting grant (${grant}). Current: ${formatMoneyLabel(user.chipBalance)}.`,
      confirmLabel: 'Reset chips',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    await withBusy(`reset-${user.id}`, async () => {
      const res = await resetAdminUserChips(token, user.id);
      flash(`Reset ${res.username} to ${formatMoneyLabel(res.balance)}`);
      const list = await fetchAdminUsers(token, userQuery);
      setUsers(list.users);
    });
  }

  async function refreshGames() {
    if (!token) return;
    await withBusy('games', async () => {
      const games = await fetchAdminGames(token);
      setTables(games.tables);
      setContests(games.contests);
      const overview = await fetchAdminOverview(token);
      setStats({
        userCount: overview.userCount,
        liveTables: overview.liveTables,
        liveContests: overview.liveContests,
      });
      flash('Live games refreshed');
    });
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
          <code className="rounded bg-sidebar/5 px-1.5 py-0.5 text-xs">ADMIN_USERNAMES</code>.
        </p>
      </LobbyPageShell>
    );
  }

  return (
    <LobbyPageShell title="Admin" subtitle="Site, players, and live tables" signedIn error={error}>
      {okMsg ? (
        <p
          className="mb-4 status-chip border-positive/30 bg-positive/10 text-positive text-xs"
          role="status"
        >
          {okMsg}
        </p>
      ) : null}

      {stats ? (
        <div className="mb-5 flex flex-wrap gap-3">
          <StatCard label="Users" value={stats.userCount} />
          <StatCard label="Live tables" value={stats.liveTables} />
          <StatCard label="Contests" value={stats.liveContests} />
          <StatCard label="Start grant" value={formatMoneyLabel(economy.startingChipGrant)} />
        </div>
      ) : null}

      <nav
        aria-label="Admin sections"
        className="mb-5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              id={`${navId}-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-display font-bold uppercase tracking-[0.14em] transition ${
                active
                  ? 'bg-sidebar text-mushroom shadow-[0_6px_16px_rgb(29_4_50/0.18)]'
                  : 'border border-sidebar/15 bg-cream/80 text-ink-strong-muted hover:border-sidebar/30 hover:text-ink-strong'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-5">
        {tab === 'users' ? (
          <Section
            title="Users"
            description="Search accounts, top up Wuffies, or reset bankrolls to the starting grant."
          >
            <form onSubmit={(e) => void searchUsers(e)} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search by username…"
                className={`${fieldClass} mt-0 sm:flex-1`}
                aria-label="Search users"
              />
              <button
                type="submit"
                disabled={busy}
                className="btn-ghost min-h-11 px-5 disabled:opacity-50"
              >
                {busyKey === 'users-search' ? 'Searching…' : 'Search'}
              </button>
            </form>

            <ul className="divide-y divide-sidebar/8 rounded-xl border border-sidebar/10 bg-mushroom/[0.03]">
              {users.map((u) => {
                const topping = busyKey === `topup-${u.id}`;
                const resetting = busyKey === `reset-${u.id}`;
                return (
                  <li
                    key={u.id}
                    className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-semibold text-ink-strong">
                        {u.username}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-strong-muted">
                        <MoneyAmount amount={u.chipBalance} showChips className="text-sm" />
                        <span className="text-xs tabular-nums opacity-70">
                          joined {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          placeholder="Top-up amount"
                          value={creditAmounts[u.id] ?? ''}
                          onChange={(e) =>
                            setCreditAmounts((m) => ({ ...m, [u.id]: e.target.value }))
                          }
                          className="w-32 rounded-lg border border-sidebar/15 bg-cream px-2.5 py-2 text-sm tabular-nums text-ink-strong outline-none focus:border-sidebar/40"
                          aria-label={`Top-up amount for ${u.username}`}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void topUp(u.id)}
                          className="rounded-lg border border-positive/35 bg-positive/10 px-3 py-2 text-sm font-medium text-positive transition hover:bg-positive/15 disabled:opacity-50"
                        >
                          {topping ? '…' : 'Top up'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void resetChips(u)}
                          className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                          title={`Reset to ${formatMoneyLabel(economy.startingChipGrant)}`}
                        >
                          {resetting ? '…' : 'Reset chips'}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {users.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-ink-strong-muted">
                  No users match your search.
                </li>
              ) : null}
            </ul>
          </Section>
        ) : null}

        {tab === 'content' ? (
          <Section
            title="Site banner"
            description="Optional notice shown at the top of lobby pages (not on live tables)."
          >
            <form onSubmit={(e) => void saveAnnouncement(e)} className="space-y-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-sidebar/10 bg-mushroom/[0.04] px-3 py-3 text-sm text-ink-strong">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-sidebar"
                  checked={announcement.enabled}
                  onChange={(e) =>
                    setAnnouncement((a) => ({ ...a, enabled: e.target.checked }))
                  }
                />
                <span>
                  <span className="font-medium">Show banner on lobby pages</span>
                  <span className="mt-0.5 block text-xs text-ink-strong-muted">
                    Disabled until checked and text is non-empty
                  </span>
                </span>
              </label>
              <label className="block">
                <span className={labelClass}>Banner text</span>
                <textarea
                  value={announcement.text}
                  onChange={(e) => setAnnouncement((a) => ({ ...a, text: e.target.value }))}
                  rows={4}
                  maxLength={2000}
                  className={fieldClass}
                  placeholder="Announcement shown above lobby content…"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[12rem] disabled:opacity-50"
              >
                {busyKey === 'announce' ? 'Saving…' : 'Save banner'}
              </button>
            </form>
          </Section>
        ) : null}

        {tab === 'home' ? (
          <Section
            title="Home landing"
            description="Feature blocks on the home page — title, body, CTA, link, and image. Add or remove blocks as needed."
            action={
              <button
                type="button"
                disabled={busy || homeFeatures.length >= MAX_HOME_BLOCKS}
                onClick={() => addHomeFeature()}
                className="btn-ghost min-h-9 px-4 text-xs disabled:opacity-50"
              >
                Add block
              </button>
            }
          >
            <form onSubmit={(e) => void saveHomeFeatures(e)} className="space-y-3">
              {homeFeatures.map((feature, index) => {
                const open = openBlocks[index] ?? false;
                return (
                  <div
                    key={index}
                    className="overflow-hidden rounded-xl border border-sidebar/12 bg-mushroom/[0.03]"
                  >
                    <div className="flex flex-wrap items-center gap-2 border-b border-sidebar/8 px-3 py-2.5 sm:px-4">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() =>
                          setOpenBlocks((m) => ({ ...m, [index]: !open }))
                        }
                        aria-expanded={open}
                      >
                        <span className="font-display text-sm font-semibold uppercase tracking-wider text-ink-strong">
                          Block {index + 1}
                        </span>
                        <span className="ml-2 truncate text-sm text-ink-strong-muted">
                          {feature.title || 'Untitled'}
                        </span>
                      </button>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={index === 0 || busy}
                          onClick={() => moveHomeFeature(index, -1)}
                          className="rounded-md border border-sidebar/15 px-2.5 py-1 text-xs font-medium text-ink-strong disabled:opacity-35"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          disabled={index === homeFeatures.length - 1 || busy}
                          onClick={() => moveHomeFeature(index, 1)}
                          className="rounded-md border border-sidebar/15 px-2.5 py-1 text-xs font-medium text-ink-strong disabled:opacity-35"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          disabled={homeFeatures.length <= 1 || busy}
                          onClick={() => removeHomeFeature(index)}
                          className="rounded-md border border-danger/25 px-2.5 py-1 text-xs font-medium text-danger disabled:opacity-35"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenBlocks((m) => ({ ...m, [index]: !open }))
                          }
                          className="rounded-md border border-sidebar/15 px-2.5 py-1 text-xs font-medium text-ink-strong-muted"
                        >
                          {open ? 'Collapse' : 'Edit'}
                        </button>
                      </div>
                    </div>
                    {open ? (
                      <div className="space-y-3 p-3 sm:p-4">
                        <label className="block">
                          <span className={labelClass}>Title</span>
                          <input
                            value={feature.title}
                            onChange={(e) => updateHomeFeature(index, { title: e.target.value })}
                            className={fieldClass}
                            maxLength={120}
                            required
                          />
                        </label>
                        <label className="block">
                          <span className={labelClass}>Body</span>
                          <textarea
                            value={feature.body}
                            onChange={(e) => updateHomeFeature(index, { body: e.target.value })}
                            rows={3}
                            maxLength={2000}
                            className={fieldClass}
                            required
                          />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className={labelClass}>CTA label</span>
                            <input
                              value={feature.cta}
                              onChange={(e) => updateHomeFeature(index, { cta: e.target.value })}
                              className={fieldClass}
                              maxLength={80}
                              required
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Link (href)</span>
                            <input
                              value={feature.href}
                              onChange={(e) => updateHomeFeature(index, { href: e.target.value })}
                              className={fieldClass}
                              placeholder="/contests"
                              maxLength={500}
                              required
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Image path</span>
                            <input
                              value={feature.image}
                              onChange={(e) => updateHomeFeature(index, { image: e.target.value })}
                              className={fieldClass}
                              placeholder="/home-knockout.png"
                              maxLength={500}
                              required
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Image alt</span>
                            <input
                              value={feature.imageAlt}
                              onChange={(e) =>
                                updateHomeFeature(index, { imageAlt: e.target.value })
                              }
                              className={fieldClass}
                              maxLength={200}
                              required
                            />
                          </label>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-strong">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-sidebar"
                            checked={feature.imageFirst}
                            onChange={(e) =>
                              updateHomeFeature(index, { imageFirst: e.target.checked })
                            }
                          />
                          Image on the left (desktop)
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy || homeFeatures.length >= MAX_HOME_BLOCKS}
                  onClick={() => addHomeFeature()}
                  className="btn-ghost min-h-11 px-5 disabled:opacity-50"
                >
                  Add block
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[12rem] disabled:opacity-50"
                >
                  {busyKey === 'home' ? 'Saving…' : 'Save home landing'}
                </button>
              </div>
              <p className="text-xs text-ink-strong-muted">
                {homeFeatures.length}/{MAX_HOME_BLOCKS} blocks
              </p>
            </form>
          </Section>
        ) : null}

        {tab === 'pages' ? (
          <Section
            title="Page text"
            description="Titles and subtitles for lobby and auth pages. Changes appear after save (clients refresh within ~30s or on next visit)."
          >
            <form onSubmit={(e) => void savePages(e)} className="space-y-3">
              {PAGE_COPY_KEYS.map((key) => {
                const open = openPage === key;
                const row = pagesCopy[key] ?? DEFAULT_PAGES_COPY[key];
                return (
                  <div
                    key={key}
                    className="overflow-hidden rounded-xl border border-sidebar/12 bg-mushroom/[0.03]"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left sm:px-4"
                      onClick={() => setOpenPage(open ? null : key)}
                      aria-expanded={open}
                    >
                      <span>
                        <span className="font-display text-sm font-semibold uppercase tracking-wider text-ink-strong">
                          {PAGE_COPY_LABELS[key]}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-ink-strong-muted">
                          {row.title}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-strong-muted">
                        {open ? 'Collapse' : 'Edit'}
                      </span>
                    </button>
                    {open ? (
                      <div className="space-y-3 border-t border-sidebar/8 p-3 sm:p-4">
                        <label className="block">
                          <span className={labelClass}>
                            {key === 'homeAuthFooter' ? 'Lead-in text' : 'Title'}
                          </span>
                          <input
                            value={row.title}
                            onChange={(e) =>
                              setPagesCopy((p) => ({
                                ...p,
                                [key]: { ...p[key], title: e.target.value },
                              }))
                            }
                            className={fieldClass}
                            maxLength={200}
                            required
                          />
                        </label>
                        <label className="block">
                          <span className={labelClass}>
                            {key === 'homeAuthFooter'
                              ? 'Link labels (display only)'
                              : 'Subtitle'}
                          </span>
                          <textarea
                            value={row.subtitle}
                            onChange={(e) =>
                              setPagesCopy((p) => ({
                                ...p,
                                [key]: { ...p[key], subtitle: e.target.value },
                              }))
                            }
                            rows={3}
                            maxLength={2000}
                            className={fieldClass}
                            required
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <button
                type="submit"
                disabled={busy}
                className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[12rem] disabled:opacity-50"
              >
                {busyKey === 'pages' ? 'Saving…' : 'Save page text'}
              </button>
            </form>
          </Section>
        ) : null}

        {tab === 'economy' ? (
          <Section
            title="Economy & rooms"
            description="New-player grants, free refills, and how long empty tables stay open before closing."
          >
            <form onSubmit={(e) => void saveEconomy(e)} className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Starting grant</span>
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
                  className={`${fieldClass} tabular-nums`}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Refill threshold</span>
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
                  className={`${fieldClass} tabular-nums`}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Refill grant</span>
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
                  className={`${fieldClass} tabular-nums`}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelClass}>Room inactivity (minutes)</span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  value={roomSettings.inactivityMinutes}
                  onChange={(e) =>
                    setRoomSettings({
                      inactivityMinutes: Number(e.target.value),
                    })
                  }
                  className={`${fieldClass} tabular-nums`}
                />
                <span className="mt-1.5 block text-xs text-ink-strong-muted">
                  Close private/public cash tables after this many minutes with no humans present
                  (default 15). Contests are never auto-closed. Allowed range: 1–1440 minutes.
                </span>
              </label>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[12rem] disabled:opacity-50"
                >
                  {busyKey === 'economy' ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </form>
          </Section>
        ) : null}

        {tab === 'games' ? (
          <Section
            title="Live games"
            description="In-memory tables and contests on this server process."
            action={
              <button
                type="button"
                disabled={busy}
                onClick={() => void refreshGames()}
                className="btn-ghost min-h-9 px-4 text-xs disabled:opacity-50"
              >
                {busyKey === 'games' ? '…' : 'Refresh'}
              </button>
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
                          {t.contestId
                            ? 'Contest'
                            : t.isPrivate
                              ? t.playMoney
                                ? 'Private (play)'
                                : 'Private'
                              : t.stakeId ?? 'Public'}
                        </td>
                        <td className="px-3 py-2.5 text-ink-strong-muted">
                          {t.handInProgress ? 'Active' : t.idle ? 'Idle' : 'Waiting'}
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
                {contests.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-sidebar/6 px-3 py-2.5 text-sm last:border-0"
                  >
                    <span className="text-ink-strong">
                      <span className="font-medium">{c.name}</span>{' '}
                      <span className="text-ink-strong-muted">
                        · {c.status} · {c.entrants.length}/{c.fieldSize}
                        {c.isPrivate ? ' · private' : ''}
                      </span>
                    </span>
                    <Link
                      href={`/contest/${c.id}`}
                      className="font-medium text-sidebar underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  </li>
                ))}
                {contests.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-ink-strong-muted">No contests.</li>
                ) : null}
              </ul>
            </div>
          </Section>
        ) : null}
      </div>
    </LobbyPageShell>
  );
}

export default function AdminPage() {
  return <AdminPageInner />;
}
