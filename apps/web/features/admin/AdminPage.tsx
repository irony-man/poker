'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useConfirm } from '@/components/ConfirmPopover';
import { BOT_PERSONALITY_IDS, type BotPersonalityId } from '@poker/engine';
import {
  creditAdminUser,
  creditAdminUserWhuffies,
  fetchAdminBotGroups,
  fetchAdminEconomy,
  fetchAdminGames,
  fetchAdminHomeFeatures,
  fetchAdminOverview,
  fetchAdminPages,
  fetchAdminRoomSettings,
  fetchAdminSounds,
  fetchAdminUsers,
  fetchMe,
  patchAdminAnnouncement,
  patchAdminBotGroups,
  patchAdminEconomy,
  patchAdminHomeFeatures,
  patchAdminPages,
  patchAdminRoomSettings,
  patchAdminSounds,
  requestAdminSoundUploadUrl,
  resetAdminUserChips,
  resetAdminUserWhuffies,
  type AdminContestRow,
  type AdminRoomSettings,
  type AdminTableRow,
  type AdminUserRow,
  type BotGroup,
  type HomeLandingFeature,
  type SiteAnnouncement,
  type SiteEconomy,
  type TableSoundKind,
  type TableSoundsConfig,
  DEFAULT_TABLE_SOUND_URLS,
  TABLE_SOUND_KINDS,
  TABLE_SOUND_LABELS,
  defaultTableSoundsConfig,
} from '@/lib/api';
import { formatMoneyLabel } from '@/lib/currency';
import { DEFAULT_HOME_FEATURES } from '@/components/HomeLanding';
import { clonePagesCopy, type PagesCopy } from '@/lib/pageCopy';
import { readStoredSession } from '@/lib/session';
import { useSession } from '@/lib/store';
import { useLobbySession } from '@/lib/useLobbySession';
import {
  DEFAULT_BOT_NAME_LIST,
  emptyBotGroup,
  groupBulkText,
  normalizeAdminBotGroup,
  parseBulkBotRoster,
  pruneNamePersonalities,
  rosterToBulkText,
  slugBotGroupId,
  MAX_BOT_GROUPS,
} from './botRoster';
import { parseAdminTab, TABS, MAX_HOME_BLOCKS, type AdminTab } from './tabs';
import { StatCard } from './ui';
import { UsersSection } from './sections/Users';
import { ContentSection } from './sections/Content';
import { BLANK_HOME_BLOCK, HomeSection } from './sections/Home';
import { PagesSection } from './sections/Pages';
import { BotsSection } from './sections/Bots';
import { EconomySection } from './sections/Economy';
import { SoundsSection } from './sections/Sounds';
import { GamesSection } from './sections/Games';

function AdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authReady, signedIn } = useLobbySession();
  const confirm = useConfirm();
  const sessionToken = useSession((s) => s.sessionToken);
  const token = sessionToken ?? readStoredSession()?.sessionToken ?? null;
  const navId = useId();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>(() => parseAdminTab(searchParams.get('tab')));
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [announcement, setAnnouncement] = useState<SiteAnnouncement>({
    enabled: false,
    text: '',
  });
  const [economy, setEconomy] = useState<SiteEconomy>({
    startingChipGrant: 25000,
    refillThreshold: 1000,
    refillGrant: 5000,
    startingWhuffieGrant: 0,
  });
  const [roomSettings, setRoomSettings] = useState<AdminRoomSettings>({
    inactivityMinutes: 15,
  });
  const [sounds, setSounds] = useState<TableSoundsConfig>(() => defaultTableSoundsConfig());
  const [uploadingSound, setUploadingSound] = useState<TableSoundKind | null>(null);
  const [soundUploadDisabled, setSoundUploadDisabled] = useState(false);
  const soundUploadKindRef = useRef<TableSoundKind | null>(null);
  const soundFileInputRef = useRef<HTMLInputElement>(null);
  const [homeFeatures, setHomeFeatures] = useState<HomeLandingFeature[]>(
    () => DEFAULT_HOME_FEATURES.map((f) => ({ ...f })),
  );
  const [pagesCopy, setPagesCopy] = useState<PagesCopy>(() => clonePagesCopy());
  const [botGroups, setBotGroups] = useState<BotGroup[]>(() => {
    const g = emptyBotGroup();
    g.id = 'classic';
    g.name = 'Classic';
    g.isDefault = true;
    return [g];
  });
  const [botNameDrafts, setBotNameDrafts] = useState<Record<string, string>>(() => {
    const g = emptyBotGroup();
    g.id = 'classic';
    return { classic: rosterToBulkText(g.names, g.namePersonalities) };
  });
  const [openBotGroup, setOpenBotGroup] = useState<string | null>('classic');
  const [botNameInput, setBotNameInput] = useState('');
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [openBlocks, setOpenBlocks] = useState<Record<number, boolean>>({ 0: true });
  const [openPage, setOpenPage] = useState<string | null>('host');
  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
  const [whuffieCreditAmounts, setWhuffieCreditAmounts] = useState<Record<string, string>>({});
  const [tables, setTables] = useState<AdminTableRow[]>([]);
  const [contests, setContests] = useState<AdminContestRow[]>([]);
  const [stats, setStats] = useState<{ userCount: number; liveTables: number; liveContests: number } | null>(
    null,
  );

  const busy = busyKey !== null;

  useEffect(() => {
    setTab(parseAdminTab(searchParams.get('tab')));
  }, [searchParams]);

  const selectTab = useCallback(
    (next: AdminTab) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'users') params.delete('tab');
      else params.set('tab', next);
      const q = params.toString();
      router.replace(q ? `/admin?${q}` : '/admin', { scroll: false });
    },
    [router, searchParams],
  );

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
      const [overview, eco, games, userList, home, pages, rooms, bots, soundCfg] = await Promise.all([
        fetchAdminOverview(token),
        fetchAdminEconomy(token),
        fetchAdminGames(token),
        fetchAdminUsers(token),
        fetchAdminHomeFeatures(token),
        fetchAdminPages(token),
        fetchAdminRoomSettings(token),
        fetchAdminBotGroups(token),
        fetchAdminSounds(token),
      ]);
      setAnnouncement(overview.announcement);
      setEconomy(eco);
      setRoomSettings(rooms);
      setSounds({
        enabled: soundCfg.enabled !== false,
        urls: { ...DEFAULT_TABLE_SOUND_URLS, ...soundCfg.urls },
      });
      setHomeFeatures(
        home.features?.length
          ? home.features
          : DEFAULT_HOME_FEATURES.map((f) => ({ ...f })),
      );
      setPagesCopy(pages.pages ? clonePagesCopy(pages.pages) : clonePagesCopy());
      const groups = (bots.groups?.length
        ? bots.groups
        : [
            {
              id: 'classic',
              name: 'Classic',
              names: DEFAULT_BOT_NAME_LIST,
              isDefault: true,
              defaultPersonality: null as BotPersonalityId | null,
              namePersonalities: {} as Record<string, BotPersonalityId>,
            },
          ]
      ).map(normalizeAdminBotGroup);
      setBotGroups(groups);
      setBotNameDrafts(
        Object.fromEntries(
          groups.map((g) => [g.id, rosterToBulkText(g.names, g.namePersonalities)]),
        ),
      );
      setOpenBotGroup((cur) => cur ?? groups[0]?.id ?? null);
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
          startingWhuffieGrant: Math.floor(Number(economy.startingWhuffieGrant)),
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

  async function saveBotGroups(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await withBusy('bots', async () => {
      const payload: BotGroup[] = [];
      for (const g of botGroups) {
        const text = groupBulkText(g, botNameDrafts);
        const parsed = parseBulkBotRoster(text);
        if (!parsed.ok) {
          setOpenBotGroup(g.id);
          setShowBulkEdit(true);
          throw new Error(
            `${g.name || g.id}: ${parsed.errors[0]}${
              parsed.errors.length > 1 ? ` (+${parsed.errors.length - 1} more)` : ''
            }`,
          );
        }
        payload.push({
          ...g,
          names: parsed.names,
          defaultPersonality: g.defaultPersonality ?? null,
          namePersonalities: parsed.namePersonalities,
        });
      }
      if (!payload.some((g) => g.isDefault) && payload[0]) {
        payload[0] = { ...payload[0], isDefault: true };
      }
      const res = await patchAdminBotGroups(token, payload);
      setBotGroups(res.groups.map(normalizeAdminBotGroup));
      setBotNameDrafts(
        Object.fromEntries(
          res.groups.map((g) => [
            g.id,
            rosterToBulkText(g.names, g.namePersonalities),
          ]),
        ),
      );
      flash('Bot groups saved');
    });
  }

  async function saveSounds(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await withBusy('sounds', async () => {
      const next = await patchAdminSounds(token, {
        enabled: sounds.enabled,
        urls: Object.fromEntries(
          TABLE_SOUND_KINDS.map((k) => [k, sounds.urls[k] ?? '']),
        ) as Partial<Record<TableSoundKind, string>>,
      });
      setSounds({
        enabled: next.enabled !== false,
        urls: { ...DEFAULT_TABLE_SOUND_URLS, ...next.urls },
      });
      flash('Table sounds saved');
    });
  }

  function previewSound(kind: TableSoundKind) {
    const url = (sounds.urls[kind] ?? DEFAULT_TABLE_SOUND_URLS[kind]).trim();
    if (!url) {
      setError(`No URL for ${TABLE_SOUND_LABELS[kind]}`);
      return;
    }
    try {
      const audio = new Audio(url);
      void audio.play().catch(() => {
        setError(`Could not play ${TABLE_SOUND_LABELS[kind]}`);
      });
    } catch {
      setError(`Could not play ${TABLE_SOUND_LABELS[kind]}`);
    }
  }

  function triggerSoundUpload(kind: TableSoundKind) {
    soundUploadKindRef.current = kind;
    soundFileInputRef.current?.click();
  }

  async function uploadSound(kind: TableSoundKind, file: File) {
    if (!token || uploadingSound) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Sound file must be 5 MB or smaller');
      return;
    }
    const contentType = file.type === 'audio/mp3' ? 'audio/mp3' : 'audio/mpeg';
    if (file.type && file.type !== 'audio/mpeg' && file.type !== 'audio/mp3') {
      setError('Use MP3 audio files only');
      return;
    }
    setUploadingSound(kind);
    setError(null);
    try {
      const { uploadUrl, publicUrl } = await requestAdminSoundUploadUrl(token, {
        kind,
        contentType,
        contentLength: file.size,
      });
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
      });
      if (!putRes.ok) throw new Error('Upload to storage failed');
      const nextUrls = {
        ...Object.fromEntries(TABLE_SOUND_KINDS.map((k) => [k, sounds.urls[k] ?? ''])),
        [kind]: publicUrl,
      } as Partial<Record<TableSoundKind, string>>;
      const next = await patchAdminSounds(token, {
        enabled: sounds.enabled,
        urls: nextUrls,
      });
      setSounds({
        enabled: next.enabled !== false,
        urls: { ...DEFAULT_TABLE_SOUND_URLS, ...next.urls },
      });
      flash(`${TABLE_SOUND_LABELS[kind]} uploaded and saved`);
      try {
        const audio = new Audio(publicUrl);
        void audio.play().catch(() => {
          setError(`Could not play ${TABLE_SOUND_LABELS[kind]}`);
        });
      } catch {
        setError(`Could not play ${TABLE_SOUND_LABELS[kind]}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not upload sound';
      if (msg.includes('storage is not configured') || msg.includes('503')) {
        setSoundUploadDisabled(true);
      }
      setError(msg);
    } finally {
      setUploadingSound(null);
      soundUploadKindRef.current = null;
    }
  }

  async function onSoundFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const kind = soundUploadKindRef.current;
    e.target.value = '';
    if (!file || !kind) return;
    await uploadSound(kind, file);
  }

  function updateBotGroup(id: string, patch: Partial<BotGroup>) {
    setBotGroups((list) => {
      let next = list.map((g) => (g.id === id ? { ...g, ...patch } : g));
      if (patch.isDefault) {
        next = next.map((g) => ({ ...g, isDefault: g.id === id }));
      }
      return next;
    });
  }

  function addBotGroup() {
    setBotGroups((list) => {
      if (list.length >= MAX_BOT_GROUPS) return list;
      const g = emptyBotGroup();
      if (list.length === 0) g.isDefault = true;
      setBotNameDrafts((m) => ({ ...m, [g.id]: rosterToBulkText(g.names, g.namePersonalities) }));
      setOpenBotGroup(g.id);
      return [...list, g];
    });
  }

  function removeBotGroup(id: string) {
    setBotGroups((list) => {
      if (list.length <= 1) return list;
      const next = list.filter((g) => g.id !== id);
      if (!next.some((g) => g.isDefault) && next[0]) {
        next[0] = { ...next[0], isDefault: true };
      }
      setBotNameDrafts((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
      setOpenBotGroup((cur) => (cur === id ? next[0]?.id ?? null : cur));
      return next;
    });
  }

  function renameBotGroupId(fromId: string, rawNext: string) {
    const nextId = slugBotGroupId(rawNext, fromId);
    if (nextId === fromId) return;
    setBotGroups((list) => {
      if (list.some((g) => g.id === nextId && g.id !== fromId)) return list;
      return list.map((g) => (g.id === fromId ? { ...g, id: nextId } : g));
    });
    setBotNameDrafts((m) => {
      const text = m[fromId];
      if (text === undefined) return m;
      const copy = { ...m };
      delete copy[fromId];
      copy[nextId] = text;
      return copy;
    });
    setOpenBotGroup((cur) => (cur === fromId ? nextId : cur));
  }

  function setBotGroupNames(id: string, names: string[]) {
    setBotGroups((list) => {
      const next = list.map((g) => {
        if (g.id !== id) return g;
        const updated = {
          ...g,
          names,
          namePersonalities: pruneNamePersonalities(names, g.namePersonalities),
        };
        setBotNameDrafts((m) => ({
          ...m,
          [id]: rosterToBulkText(updated.names, updated.namePersonalities),
        }));
        return updated;
      });
      return next;
    });
  }

  function setBotGroupDefaultPersonality(id: string, value: string) {
    const defaultPersonality =
      value && (BOT_PERSONALITY_IDS as readonly string[]).includes(value)
        ? (value as BotPersonalityId)
        : null;
    updateBotGroup(id, { defaultPersonality });
  }

  function setBotNamePersonality(groupId: string, name: string, value: string) {
    setBotGroups((list) =>
      list.map((g) => {
        if (g.id !== groupId) return g;
        const namePersonalities = { ...g.namePersonalities };
        if (value && (BOT_PERSONALITY_IDS as readonly string[]).includes(value)) {
          namePersonalities[name] = value as BotPersonalityId;
        } else {
          delete namePersonalities[name];
        }
        const updated = { ...g, namePersonalities };
        setBotNameDrafts((m) => ({
          ...m,
          [groupId]: rosterToBulkText(updated.names, updated.namePersonalities),
        }));
        return updated;
      }),
    );
  }

  function addBotNameToGroup(id: string, raw: string) {
    const n = raw.trim().slice(0, 24);
    if (!n) return;
    const group = botGroups.find((g) => g.id === id);
    const current = group?.names ?? [];
    if (current.some((x) => x.toLowerCase() === n.toLowerCase())) return;
    if (current.length >= 40) return;
    setBotGroupNames(id, [...current, n]);
    setBotNameInput('');
  }

  function removeBotNameFromGroup(id: string, name: string) {
    const group = botGroups.find((g) => g.id === id);
    const current = group?.names ?? [];
    const next = current.filter((x) => x !== name);
    if (next.length === 0) return;
    setBotGroupNames(id, next);
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
      flash(`Credited ${formatMoneyLabel(res.credited)} chips to ${res.username}`);
      setCreditAmounts((m) => ({ ...m, [userId]: '' }));
      const list = await fetchAdminUsers(token, userQuery);
      setUsers(list.users);
    });
  }

  async function topUpWhuffies(userId: string) {
    if (!token) return;
    const raw = whuffieCreditAmounts[userId] ?? '';
    const amount = Math.floor(Number(raw));
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a positive Whuffies amount');
      return;
    }
    await withBusy(`topup-whuffie-${userId}`, async () => {
      const res = await creditAdminUserWhuffies(token, userId, amount);
      flash(`Credited ${formatMoneyLabel(res.credited)} Whuffies to ${res.username}`);
      setWhuffieCreditAmounts((m) => ({ ...m, [userId]: '' }));
      const list = await fetchAdminUsers(token, userQuery);
      setUsers(list.users);
    });
  }

  async function resetChips(user: AdminUserRow) {
    if (!token) return;
    const grant = formatMoneyLabel(economy.startingChipGrant);
    const ok = await confirm({
      title: `Reset ${user.username}?`,
      description: `Set their chip bankroll to the starting grant (${grant}). Current: ${formatMoneyLabel(user.chipBalance)}.`,
      confirmLabel: 'Reset chips',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    await withBusy(`reset-${user.id}`, async () => {
      const res = await resetAdminUserChips(token, user.id);
      flash(`Reset ${res.username} chips to ${formatMoneyLabel(res.balance)}`);
      const list = await fetchAdminUsers(token, userQuery);
      setUsers(list.users);
    });
  }

  async function resetWhuffies(user: AdminUserRow) {
    if (!token) return;
    const grant = formatMoneyLabel(economy.startingWhuffieGrant);
    const ok = await confirm({
      title: `Reset ${user.username} Whuffies?`,
      description: `Set their Whuffies rating to the starting grant (${grant}). Current: ${formatMoneyLabel(user.whuffieBalance)}.`,
      confirmLabel: 'Reset Whuffies',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    await withBusy(`reset-whuffie-${user.id}`, async () => {
      const res = await resetAdminUserWhuffies(token, user.id);
      flash(`Reset ${res.username} Whuffies to ${formatMoneyLabel(res.balance)}`);
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
          <StatCard label="Start chips" value={formatMoneyLabel(economy.startingChipGrant)} />
          <StatCard label="Start Whuffies" value={formatMoneyLabel(economy.startingWhuffieGrant)} />
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
              onClick={() => selectTab(t.id)}
              aria-current={active ? 'page' : undefined}
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
          <UsersSection
            userQuery={userQuery}
            users={users}
            creditAmounts={creditAmounts}
            whuffieCreditAmounts={whuffieCreditAmounts}
            busy={busy}
            busyKey={busyKey}
            economy={economy}
            onUserQuery={setUserQuery}
            onCreditAmount={(userId, value) =>
              setCreditAmounts((m) => ({ ...m, [userId]: value }))
            }
            onWhuffieCreditAmount={(userId, value) =>
              setWhuffieCreditAmounts((m) => ({ ...m, [userId]: value }))
            }
            onSearch={(e) => void searchUsers(e)}
            onTopUp={(userId) => void topUp(userId)}
            onTopUpWhuffies={(userId) => void topUpWhuffies(userId)}
            onResetChips={(user) => void resetChips(user)}
            onResetWhuffies={(user) => void resetWhuffies(user)}
          />
        ) : null}

        {tab === 'content' ? (
          <ContentSection
            announcement={announcement}
            busy={busy}
            busyKey={busyKey}
            onAnnouncement={(patch) => setAnnouncement((a) => ({ ...a, ...patch }))}
            onSave={(e) => void saveAnnouncement(e)}
          />
        ) : null}

        {tab === 'home' ? (
          <HomeSection
            homeFeatures={homeFeatures}
            openBlocks={openBlocks}
            busy={busy}
            busyKey={busyKey}
            onToggleBlock={(index) =>
              setOpenBlocks((m) => ({ ...m, [index]: !(m[index] ?? false) }))
            }
            onUpdate={updateHomeFeature}
            onMove={moveHomeFeature}
            onRemove={removeHomeFeature}
            onAdd={addHomeFeature}
            onSave={(e) => void saveHomeFeatures(e)}
          />
        ) : null}

        {tab === 'pages' ? (
          <PagesSection
            pagesCopy={pagesCopy}
            openPage={openPage}
            busy={busy}
            busyKey={busyKey}
            onOpenPage={setOpenPage}
            onPagesCopy={(key, patch) =>
              setPagesCopy((p) => ({
                ...p,
                [key]: { ...p[key], ...patch },
              }))
            }
            onSave={(e) => void savePages(e)}
          />
        ) : null}

        {tab === 'bots' ? (
          <BotsSection
            botGroups={botGroups}
            botNameDrafts={botNameDrafts}
            openBotGroup={openBotGroup}
            botNameInput={botNameInput}
            showBulkEdit={showBulkEdit}
            busy={busy}
            busyKey={busyKey}
            onSelectGroup={(id) => {
              setOpenBotGroup(id);
              setBotNameInput('');
              setShowBulkEdit(false);
            }}
            onAddGroup={() => {
              addBotGroup();
              setShowBulkEdit(false);
              setBotNameInput('');
            }}
            onRemoveGroup={removeBotGroup}
            onRenameId={renameBotGroupId}
            onUpdateGroup={updateBotGroup}
            onDefaultPersonality={setBotGroupDefaultPersonality}
            onNamePersonality={setBotNamePersonality}
            onNameInput={setBotNameInput}
            onAddName={addBotNameToGroup}
            onRemoveName={removeBotNameFromGroup}
            onDraft={(id, text) => {
              setBotNameDrafts((m) => ({ ...m, [id]: text }));
              const next = parseBulkBotRoster(text);
              if (!next.ok) return;
              setBotGroups((list) =>
                list.map((g) =>
                  g.id === id
                    ? {
                        ...g,
                        names: next.names,
                        namePersonalities: next.namePersonalities,
                      }
                    : g,
                ),
              );
            }}
            onToggleBulk={(group) => {
              if (showBulkEdit) {
                const check = parseBulkBotRoster(groupBulkText(group, botNameDrafts));
                if (!check.ok) {
                  setError(
                    `${group.name || group.id}: fix bulk edit errors before using chip editor — ${check.errors[0]}`,
                  );
                  return;
                }
                setBotGroups((list) =>
                  list.map((g) =>
                    g.id === group.id
                      ? {
                          ...g,
                          names: check.names,
                          namePersonalities: check.namePersonalities,
                        }
                      : g,
                  ),
                );
                setBotNameDrafts((m) => ({
                  ...m,
                  [group.id]: rosterToBulkText(check.names, check.namePersonalities),
                }));
              } else {
                setBotNameDrafts((m) => ({
                  ...m,
                  [group.id]: rosterToBulkText(group.names, group.namePersonalities),
                }));
              }
              setError(null);
              setShowBulkEdit((v) => !v);
            }}
            onSave={(e) => void saveBotGroups(e)}
          />
        ) : null}

        {tab === 'economy' ? (
          <EconomySection
            economy={economy}
            roomSettings={roomSettings}
            busy={busy}
            busyKey={busyKey}
            onEconomy={(patch) => setEconomy((eco) => ({ ...eco, ...patch }))}
            onRoomSettings={setRoomSettings}
            onSave={(e) => void saveEconomy(e)}
          />
        ) : null}

        {tab === 'sounds' ? (
          <SoundsSection
            sounds={sounds}
            soundFileInputRef={soundFileInputRef}
            soundUploadDisabled={soundUploadDisabled}
            uploadingSound={uploadingSound}
            busy={busy}
            busyKey={busyKey}
            onSounds={(patch) => setSounds((s) => ({ ...s, ...patch }))}
            onUrl={(kind, value) =>
              setSounds((s) => ({
                ...s,
                urls: { ...s.urls, [kind]: value },
              }))
            }
            onSave={(e) => void saveSounds(e)}
            onResetDefaults={() => setSounds(defaultTableSoundsConfig())}
            onUpload={triggerSoundUpload}
            onFileSelected={(e) => void onSoundFileSelected(e)}
            onPreview={previewSound}
          />
        ) : null}

        {tab === 'games' ? (
          <GamesSection
            tables={tables}
            contests={contests}
            busy={busy}
            busyKey={busyKey}
            onRefresh={() => void refreshGames()}
          />
        ) : null}
      </div>
    </LobbyPageShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading admin…" />}>
      <AdminPageInner />
    </Suspense>
  );
}
