'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { LobbyPageShell } from '@/components/LobbyPageShell';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MoneyAmount } from '@/components/CurrencyIcon';
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
const MAX_BOT_GROUPS = 20;
const DEFAULT_BOT_NAMES =
  'AceBot, aggro\nRiverRat, caller\nBluffByte, lag\nPotOdds, balanced\nChipShark, aggro\nFoldBot, nit\nAllInAnnie, maniac\nNutsNova, tight\nCallCart, caller\nRaiseRex, aggro';

const DEFAULT_BOT_NAME_LIST = DEFAULT_BOT_NAMES.split('\n').map((line) => line.split(',')[0]!.trim());

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

type AdminTab = 'users' | 'content' | 'home' | 'pages' | 'bots' | 'economy' | 'sounds' | 'games';

const ADMIN_TABS: AdminTab[] = [
  'users',
  'content',
  'home',
  'pages',
  'bots',
  'economy',
  'sounds',
  'games',
];

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'content', label: 'Banner' },
  { id: 'home', label: 'Home page' },
  { id: 'pages', label: 'Pages' },
  { id: 'bots', label: 'Bot groups' },
  { id: 'economy', label: 'Economy' },
  { id: 'sounds', label: 'Sounds' },
  { id: 'games', label: 'Live games' },
];

function parseAdminTab(raw: string | null): AdminTab {
  if (raw && (ADMIN_TABS as string[]).includes(raw)) return raw as AdminTab;
  return 'users';
}

function emptyBotGroup(): BotGroup {
  const parsed = parseBulkBotRoster(DEFAULT_BOT_NAMES);
  const names = parsed.ok ? parsed.names : DEFAULT_BOT_NAME_LIST;
  const namePersonalities = parsed.ok ? parsed.namePersonalities : {};
  return {
    id: `group-${Date.now().toString(36)}`,
    name: 'New group',
    names,
    isDefault: false,
    defaultPersonality: null,
    namePersonalities,
  };
}

const PERSONALITY_LABELS: Record<BotPersonalityId, string> = {
  balanced: 'Balanced',
  tight: 'Tight',
  loose: 'Loose',
  aggro: 'Aggressive',
  passive: 'Passive',
  maniac: 'Maniac',
  caller: 'Caller',
  nit: 'Nit',
  lag: 'LAG',
};

const PERSONALITY_TOKEN_TO_ID: Record<string, BotPersonalityId> = (() => {
  const map: Record<string, BotPersonalityId> = {};
  for (const id of BOT_PERSONALITY_IDS) {
    map[id.toLowerCase()] = id;
    map[PERSONALITY_LABELS[id].toLowerCase()] = id;
  }
  return map;
})();

function resolvePersonalityToken(raw: string): BotPersonalityId | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return PERSONALITY_TOKEN_TO_ID[key] ?? null;
}

function pruneNamePersonalities(
  names: string[],
  map: Record<string, BotPersonalityId> | undefined,
): Record<string, BotPersonalityId> {
  const out: Record<string, BotPersonalityId> = {};
  if (!map) return out;
  for (const n of names) {
    const id = map[n];
    if (id && (BOT_PERSONALITY_IDS as readonly string[]).includes(id)) out[n] = id;
  }
  return out;
}

function normalizeAdminBotGroup(g: BotGroup): BotGroup {
  const names = g.names?.length ? g.names : DEFAULT_BOT_NAME_LIST;
  return {
    id: g.id,
    name: g.name,
    names,
    isDefault: Boolean(g.isDefault),
    defaultPersonality: g.defaultPersonality ?? null,
    namePersonalities: pruneNamePersonalities(names, g.namePersonalities),
  };
}

/** Serialize names + optional styles for bulk edit: one `Name` or `Name, style` per line. */
function rosterToBulkText(
  names: string[],
  namePersonalities: Record<string, BotPersonalityId> | undefined,
): string {
  return names
    .map((n) => {
      const p = namePersonalities?.[n];
      return p ? `${n}, ${p}` : n;
    })
    .join('\n');
}

type BulkBotRosterResult =
  | { ok: true; names: string[]; namePersonalities: Record<string, BotPersonalityId> }
  | { ok: false; errors: string[] };

/**
 * Bulk format: one bot per line.
 * - `Name` — display name only (group default / auto style)
 * - `Name, style` — style must be a known personality id or label
 */
function parseBulkBotRoster(text: string): BulkBotRosterResult {
  const errors: string[] = [];
  const names: string[] = [];
  const namePersonalities: Record<string, BotPersonalityId> = {};
  const seen = new Set<string>();
  const validHint = BOT_PERSONALITY_IDS.join(', ');
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i]!.trim();
    if (!raw) continue;

    const firstComma = raw.indexOf(',');
    let namePart: string;
    let stylePart: string | null = null;

    if (firstComma >= 0) {
      namePart = raw.slice(0, firstComma).trim();
      stylePart = raw.slice(firstComma + 1).trim();
      if (stylePart.includes(',')) {
        errors.push(`Line ${lineNo}: use one personality after the comma (valid: ${validHint})`);
        continue;
      }
    } else {
      namePart = raw;
    }

    if (!namePart) {
      errors.push(`Line ${lineNo}: missing display name before the comma`);
      continue;
    }
    if (namePart.length > 24) {
      errors.push(`Line ${lineNo}: name longer than 24 characters ("${namePart.slice(0, 24)}…")`);
      continue;
    }

    if (stylePart !== null) {
      if (!stylePart) {
        errors.push(
          `Line ${lineNo}: missing personality after comma for "${namePart}" (valid: ${validHint})`,
        );
        continue;
      }
      const styleId = resolvePersonalityToken(stylePart);
      if (!styleId) {
        errors.push(
          `Line ${lineNo}: unknown personality "${stylePart}" for "${namePart}" (valid: ${validHint})`,
        );
        continue;
      }
      namePersonalities[namePart] = styleId;
    }

    const key = namePart.toLowerCase();
    if (seen.has(key)) {
      errors.push(`Line ${lineNo}: duplicate name "${namePart}"`);
      continue;
    }
    seen.add(key);
    names.push(namePart);

    if (names.length > 40) {
      errors.push('Too many names (max 40)');
      break;
    }
  }

  if (names.length === 0 && errors.length === 0) {
    errors.push('Add at least one bot name (one per line; optional ", style")');
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, names, namePersonalities };
}

function groupBulkText(
  group: BotGroup,
  drafts: Record<string, string>,
): string {
  return drafts[group.id] ?? rosterToBulkText(group.names, group.namePersonalities);
}

function slugBotGroupId(raw: string, fallback: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s.length > 0 ? s : fallback;
}

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
          <Section
            title="Users"
            description="Search accounts, top up chips or Whuffies, or reset to the starting grants."
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
                const toppingW = busyKey === `topup-whuffie-${u.id}`;
                const resettingW = busyKey === `reset-whuffie-${u.id}`;
                return (
                  <li
                    key={u.id}
                    className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-semibold text-ink-strong">
                        {u.username}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-strong-muted">
                        <MoneyAmount amount={u.chipBalance} showChips className="text-sm" />
                        <span className="tabular-nums text-sm">
                          {formatMoneyLabel(u.whuffieBalance)} Whuffies
                        </span>
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
                          placeholder="Chips"
                          value={creditAmounts[u.id] ?? ''}
                          onChange={(e) =>
                            setCreditAmounts((m) => ({ ...m, [u.id]: e.target.value }))
                          }
                          className="w-28 rounded-lg border border-sidebar/15 bg-cream px-2.5 py-2 text-sm tabular-nums text-ink-strong outline-none focus:border-sidebar/40"
                          aria-label={`Chip top-up for ${u.username}`}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void topUp(u.id)}
                          className="rounded-lg border border-positive/35 bg-positive/10 px-3 py-2 text-sm font-medium text-positive transition hover:bg-positive/15 disabled:opacity-50"
                        >
                          {topping ? '…' : 'Top up chips'}
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
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          placeholder="Whuffies"
                          value={whuffieCreditAmounts[u.id] ?? ''}
                          onChange={(e) =>
                            setWhuffieCreditAmounts((m) => ({ ...m, [u.id]: e.target.value }))
                          }
                          className="w-28 rounded-lg border border-sidebar/15 bg-cream px-2.5 py-2 text-sm tabular-nums text-ink-strong outline-none focus:border-sidebar/40"
                          aria-label={`Whuffies credit for ${u.username}`}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void topUpWhuffies(u.id)}
                          className="rounded-lg border border-positive/35 bg-positive/10 px-3 py-2 text-sm font-medium text-positive transition hover:bg-positive/15 disabled:opacity-50"
                        >
                          {toppingW ? '…' : 'Add Whuffies'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void resetWhuffies(u)}
                          className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                          title={`Reset to ${formatMoneyLabel(economy.startingWhuffieGrant)}`}
                        >
                          {resettingW ? '…' : 'Reset Whuffies'}
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

        {tab === 'bots' ? (
          <Section
            title="Bot groups"
            description="Name packs and playing styles hosts use when seating bots. Pick a group default style and optional per-name overrides."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs tabular-nums text-ink-strong-muted">
                  {botGroups.length}/{MAX_BOT_GROUPS}
                </span>
                <button
                  type="button"
                  disabled={busy || botGroups.length >= MAX_BOT_GROUPS}
                  onClick={() => {
                    addBotGroup();
                    setShowBulkEdit(false);
                    setBotNameInput('');
                  }}
                  className="btn-ghost min-h-9 px-4 text-xs disabled:opacity-50"
                >
                  Add group
                </button>
              </div>
            }
          >
            <form onSubmit={(e) => void saveBotGroups(e)} className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]">
                {/* Group list */}
                <div
                  className="flex flex-col gap-1.5 rounded-xl border border-sidebar/10 bg-mushroom/[0.04] p-2"
                  role="listbox"
                  aria-label="Bot groups"
                >
                  {botGroups.map((group) => {
                    const selected = openBotGroup === group.id;
                    const draft = groupBulkText(group, botNameDrafts);
                    const parsed = parseBulkBotRoster(draft);
                    const nameCount = parsed.ok ? parsed.names.length : group.names.length;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setOpenBotGroup(group.id);
                          setBotNameInput('');
                          setShowBulkEdit(false);
                        }}
                        className={`rounded-lg px-3 py-2.5 text-left transition ${
                          selected
                            ? 'bg-sidebar text-mushroom shadow-[0_4px_12px_rgb(29_4_50/0.16)]'
                            : 'text-ink-strong hover:bg-sidebar/8'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate font-display text-sm font-semibold uppercase tracking-wider ${
                              selected ? 'text-mushroom' : 'text-ink-strong'
                            }`}
                          >
                            {group.name || 'Untitled'}
                          </span>
                          {group.isDefault ? (
                            <span
                              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
                                selected
                                  ? 'bg-mushroom/20 text-mushroom'
                                  : 'bg-sidebar/10 text-sidebar'
                              }`}
                            >
                              Default
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`mt-0.5 block text-xs tabular-nums ${
                            selected ? 'text-mushroom/75' : 'text-ink-strong-muted'
                          }`}
                        >
                          {nameCount} name{nameCount === 1 ? '' : 's'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Editor */}
                {(() => {
                  const group = botGroups.find((g) => g.id === openBotGroup) ?? botGroups[0];
                  if (!group) {
                    return (
                      <p className="rounded-xl border border-dashed border-sidebar/15 px-4 py-10 text-center text-sm text-ink-strong-muted">
                        Add a bot group to get started.
                      </p>
                    );
                  }
                  const draft = groupBulkText(group, botNameDrafts);
                  const parsed = parseBulkBotRoster(draft);
                  const bulkErrors = showBulkEdit && !parsed.ok ? parsed.errors : [];
                  // Prefer live bulk parse when valid so drafts stay source of truth.
                  const names = parsed.ok ? parsed.names : group.names;
                  const displayPersonalities = parsed.ok
                    ? parsed.namePersonalities
                    : group.namePersonalities;
                  return (
                    <div className="min-w-0 space-y-4 rounded-xl border border-sidebar/12 bg-cream p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-3">
                          <label className="block max-w-md">
                            <span className={labelClass}>Group name</span>
                            <input
                              value={group.name}
                              onChange={(e) => updateBotGroup(group.id, { name: e.target.value })}
                              className={fieldClass}
                              maxLength={48}
                              required
                              placeholder="e.g. Classic, Friends, Villains"
                            />
                          </label>
                          <p className="text-xs text-ink-strong-muted">
                            Key{' '}
                            <code className="rounded bg-sidebar/5 px-1.5 py-0.5 font-mono text-[11px] text-ink-strong">
                              {group.id}
                            </code>
                            <button
                              type="button"
                              className="ml-2 font-medium text-sidebar underline-offset-2 hover:underline"
                              onClick={() => {
                                const next = window.prompt('Stable id (letters, numbers, - _)', group.id);
                                if (next != null) renameBotGroupId(group.id, next);
                              }}
                            >
                              Change
                            </button>
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {group.isDefault ? (
                            <span className="inline-flex min-h-9 items-center rounded-full border border-sidebar/20 bg-sidebar/8 px-3 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-sidebar">
                              Default pack
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updateBotGroup(group.id, { isDefault: true })}
                              className="btn-ghost min-h-9 px-3 text-xs disabled:opacity-50"
                            >
                              Make default
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy || botGroups.length <= 1}
                            onClick={() => {
                              if (botGroups.length <= 1) return;
                              removeBotGroup(group.id);
                            }}
                            className="min-h-9 rounded-lg border border-danger/25 px-3 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block max-w-md">
                          <span className={labelClass}>Default style</span>
                          <select
                            value={group.defaultPersonality ?? ''}
                            onChange={(e) => setBotGroupDefaultPersonality(group.id, e.target.value)}
                            className={fieldClass}
                            disabled={busy}
                          >
                            <option value="">Auto (by name / hash)</option>
                            {BOT_PERSONALITY_IDS.map((id) => (
                              <option key={id} value={id}>
                                {PERSONALITY_LABELS[id]}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-ink-strong-muted">
                            Used when a name has no style override. Auto keeps classic name map.
                          </p>
                        </label>
                      </div>

                      <div>
                        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                          <div>
                            <span className={labelClass}>Display names & styles</span>
                            <p className="mt-0.5 text-xs text-ink-strong-muted">
                              {names.length}/40 · shown at the table when bots sit
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (showBulkEdit) {
                                const check = parseBulkBotRoster(
                                  groupBulkText(group, botNameDrafts),
                                );
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
                                  [group.id]: rosterToBulkText(
                                    check.names,
                                    check.namePersonalities,
                                  ),
                                }));
                              } else {
                                setBotNameDrafts((m) => ({
                                  ...m,
                                  [group.id]: rosterToBulkText(
                                    group.names,
                                    group.namePersonalities,
                                  ),
                                }));
                              }
                              setError(null);
                              setShowBulkEdit((v) => !v);
                            }}
                            className="text-xs font-medium text-sidebar underline-offset-2 hover:underline"
                          >
                            {showBulkEdit ? 'Chip editor' : 'Bulk edit'}
                          </button>
                        </div>

                        {showBulkEdit ? (
                          <div className="space-y-2">
                            <label className="block">
                              <span className="sr-only">Bot names and styles, one per line</span>
                              <textarea
                                value={draft}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setBotNameDrafts((m) => ({ ...m, [group.id]: text }));
                                  const next = parseBulkBotRoster(text);
                                  if (!next.ok) return;
                                  setBotGroups((list) =>
                                    list.map((g) =>
                                      g.id === group.id
                                        ? {
                                            ...g,
                                            names: next.names,
                                            namePersonalities: next.namePersonalities,
                                          }
                                        : g,
                                    ),
                                  );
                                }}
                                rows={10}
                                className={`${fieldClass} font-mono text-xs leading-relaxed ${
                                  bulkErrors.length > 0
                                    ? 'border-danger/40 focus:border-danger/50 focus:ring-danger/15'
                                    : ''
                                }`}
                                placeholder={DEFAULT_BOT_NAMES}
                                aria-invalid={bulkErrors.length > 0}
                              />
                            </label>
                            <p className="text-xs text-ink-strong-muted">
                              One bot per line: <code className="font-mono text-[11px]">Name</code> or{' '}
                              <code className="font-mono text-[11px]">Name, style</code>. Styles:{' '}
                              {BOT_PERSONALITY_IDS.join(', ')}.
                            </p>
                            {bulkErrors.length > 0 ? (
                              <ul
                                className="space-y-1 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger"
                                role="alert"
                              >
                                {bulkErrors.map((err) => (
                                  <li key={err}>{err}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-sidebar/12 bg-mushroom/[0.04] p-3">
                            <ul className="space-y-2">
                              {names.map((n) => (
                                <li
                                  key={n}
                                  className="flex flex-wrap items-center gap-2 rounded-lg border border-sidebar/10 bg-cream px-2.5 py-1.5 shadow-sm"
                                >
                                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-strong">
                                    {n}
                                  </span>
                                  <select
                                    value={displayPersonalities[n] ?? ''}
                                    onChange={(e) =>
                                      setBotNamePersonality(group.id, n, e.target.value)
                                    }
                                    className="min-h-8 max-w-[10rem] rounded-md border border-sidebar/15 bg-white px-2 text-xs text-ink-strong"
                                    aria-label={`Style for ${n}`}
                                    disabled={busy}
                                  >
                                    <option value="">
                                      {group.defaultPersonality
                                        ? `Default (${PERSONALITY_LABELS[group.defaultPersonality]})`
                                        : 'Default (auto)'}
                                    </option>
                                    {BOT_PERSONALITY_IDS.map((id) => (
                                      <option key={id} value={id}>
                                        {PERSONALITY_LABELS[id]}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => removeBotNameFromGroup(group.id, n)}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-strong-muted transition hover:bg-danger/10 hover:text-danger"
                                    aria-label={`Remove ${n}`}
                                    title="Remove"
                                  >
                                    ×
                                  </button>
                                </li>
                              ))}
                              {names.length === 0 ? (
                                <li className="text-sm text-ink-strong-muted">No names yet.</li>
                              ) : null}
                            </ul>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                              <input
                                value={botNameInput}
                                onChange={(e) => setBotNameInput(e.target.value.slice(0, 24))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addBotNameToGroup(group.id, botNameInput);
                                  }
                                }}
                                className={`${fieldClass} mt-0 sm:max-w-xs`}
                                placeholder="Add a name…"
                                maxLength={24}
                                disabled={names.length >= 40}
                                aria-label="New bot name"
                              />
                              <button
                                type="button"
                                disabled={busy || names.length >= 40 || !botNameInput.trim()}
                                onClick={() => addBotNameToGroup(group.id, botNameInput)}
                                className="btn-ghost min-h-11 px-4 disabled:opacity-50"
                              >
                                Add name
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sidebar/8 pt-4">
                <p className="text-xs text-ink-strong-muted">
                  Host create, table +Bot, and offline solo all apply these names and styles.
                </p>
                <button
                  type="submit"
                  disabled={
                    busy ||
                    botGroups.some((g) => !parseBulkBotRoster(groupBulkText(g, botNameDrafts)).ok)
                  }
                  className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[12rem] disabled:opacity-50"
                >
                  {busyKey === 'bots' ? 'Saving…' : 'Save bot groups'}
                </button>
              </div>
            </form>
          </Section>
        ) : null}

        {tab === 'economy' ? (
          <Section
            title="Economy & rooms"
            description="New-player chip grants, free chip refills, starting Whuffies rating, and how long empty tables stay open."
          >
            <form onSubmit={(e) => void saveEconomy(e)} className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Starting chips</span>
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
              <label className="block">
                <span className={labelClass}>Starting Whuffies</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={economy.startingWhuffieGrant}
                  onChange={(e) =>
                    setEconomy((eco) => ({
                      ...eco,
                      startingWhuffieGrant: Number(e.target.value),
                    }))
                  }
                  className={`${fieldClass} tabular-nums`}
                />
                <span className="mt-1.5 block text-xs text-ink-strong-muted">
                  Rating granted on signup. Contest placements add more Whuffies (not spendable chips).
                </span>
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

        {tab === 'sounds' ? (
          <Section
            title="Table sounds"
            description="Sample URLs for fold, check, streets, and win. Defaults live under /sounds/. Leave a field blank to disable that event. Paste a path or https URL to override."
          >
            <form onSubmit={(e) => void saveSounds(e)} className="space-y-4">
              <label className="flex items-center gap-3 rounded-xl border border-sidebar/10 bg-cream px-4 py-3">
                <input
                  type="checkbox"
                  checked={sounds.enabled}
                  onChange={(e) =>
                    setSounds((s) => ({ ...s, enabled: e.target.checked }))
                  }
                  className="size-4 rounded border-sidebar/30 text-sidebar focus:ring-sidebar/30"
                />
                <span className="text-sm font-medium text-ink-strong">
                  Enable table sounds site-wide
                </span>
              </label>
              <div className="grid gap-3">
                {TABLE_SOUND_KINDS.map((kind) => (
                  <div
                    key={kind}
                    className="grid gap-2 rounded-xl border border-sidebar/8 bg-cream/60 p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
                  >
                    <label className="block">
                      <span className={labelClass}>{TABLE_SOUND_LABELS[kind]}</span>
                      <span className="mt-1 block font-mono text-[11px] text-ink-strong-muted">
                        {kind}
                      </span>
                    </label>
                    <label className="block sm:col-span-1">
                      <span className="sr-only">URL for {TABLE_SOUND_LABELS[kind]}</span>
                      <input
                        type="text"
                        value={sounds.urls[kind] ?? ''}
                        placeholder={DEFAULT_TABLE_SOUND_URLS[kind]}
                        onChange={(e) =>
                          setSounds((s) => ({
                            ...s,
                            urls: { ...s.urls, [kind]: e.target.value },
                          }))
                        }
                        className={`${fieldClass} font-mono text-xs`}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => previewSound(kind)}
                      className="btn-ghost min-h-10 px-4 text-xs disabled:opacity-50"
                    >
                      Preview
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary min-h-11 w-full sm:w-auto sm:min-w-[12rem] disabled:opacity-50"
                >
                  {busyKey === 'sounds' ? 'Saving…' : 'Save sounds'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSounds(defaultTableSoundsConfig())}
                  className="btn-ghost min-h-11 px-4 text-xs disabled:opacity-50"
                >
                  Reset to defaults
                </button>
              </div>
            </form>
          </Section>
        ) : null}

        {tab === 'games' ? (
          <Section
            title="Live games"
            description="Private tables and active contests on this server. Permanent public stake lobbies and finished contests are omitted."
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
                            ? 'Contest table'
                            : t.playMoney
                              ? 'Private (play)'
                              : 'Private'}
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
                            {atTable != null && c.status === 'running'
                              ? ` · ${atTable} at table`
                              : ''}
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
