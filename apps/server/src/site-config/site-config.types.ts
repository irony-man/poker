import {
  defaultEconomy,
  type EconomySnapshot,
  REFILL_GRANT,
  REFILL_THRESHOLD,
  STARTING_CHIP_GRANT,
  STARTING_WHUFFIE_GRANT,
} from '../wallet/wallet.constants.js';

export interface SiteAnnouncement {
  enabled: boolean;
  text: string;
}

/** Home page feature blocks (Admin editable; defaults match original HomeLanding). */
export interface HomeLandingFeature {
  title: string;
  body: string;
  cta: string;
  href: string;
  image: string;
  imageAlt: string;
  /** Illustration on the left at desktop width. */
  imageFirst: boolean;
}

/** Lobby / auth page H1 + subtitle (admin “Pages” tab). */
export type PageCopyKey =
  | 'host'
  | 'join'
  | 'public'
  | 'contests'
  | 'friends'
  | 'solo'
  | 'signIn'
  | 'signUp'
  | 'homeAuthFooter';

export interface PageCopy {
  title: string;
  subtitle: string;
}

export type PagesCopy = Record<PageCopyKey, PageCopy>;

/** Cash/public room idle timeout (admin-configurable). */
export interface RoomSettings {
  /** Minutes without human presence before the room is closed. Default 15. */
  inactivityMinutes: number;
}

/** Playing styles admins can assign to a bot set or individual name. */
export type BotPersonalityId =
  | 'balanced'
  | 'tight'
  | 'loose'
  | 'aggro'
  | 'passive'
  | 'maniac'
  | 'caller'
  | 'nit'
  | 'lag';

export const BOT_PERSONALITY_IDS: readonly BotPersonalityId[] = [
  'balanced',
  'tight',
  'loose',
  'aggro',
  'passive',
  'maniac',
  'caller',
  'nit',
  'lag',
] as const;

export function isBotPersonalityId(value: string | null | undefined): value is BotPersonalityId {
  return !!value && (BOT_PERSONALITY_IDS as readonly string[]).includes(value);
}

/** Named list of bot display names; hosts can pick a group when seating bots. */
export interface BotGroup {
  id: string;
  name: string;
  names: string[];
  /** Exactly one group should be default; used when no group id is chosen. */
  isDefault: boolean;
  /**
   * Group-wide style when a name has no per-name override.
   * `null` = engine auto (built-in roster names, else stable hash).
   */
  defaultPersonality: BotPersonalityId | null;
  /** Per display-name style overrides (keys match `names`). */
  namePersonalities: Record<string, BotPersonalityId>;
}

/** Name pool + styles used when seating bots from a group. */
export interface BotSeatingConfig {
  names: string[];
  defaultPersonality: BotPersonalityId | null;
  namePersonalities: Record<string, BotPersonalityId>;
}

export const DEFAULT_ROOM_INACTIVITY_MINUTES = 15;
/** Floor for admin control (at least 1 minute). */
export const MIN_ROOM_INACTIVITY_MINUTES = 1;
/** Cap at 24 hours. */
export const MAX_ROOM_INACTIVITY_MINUTES = 24 * 60;

export const MAX_BOT_GROUPS = 20;
export const MAX_BOT_NAMES_PER_GROUP = 40;
export const MAX_BOT_GROUP_NAME_LEN = 48;
export const MAX_BOT_DISPLAY_NAME_LEN = 24;

/** Matches engine DEFAULT_BOT_NAMES; fallback when config is empty. */
export const DEFAULT_BOT_DISPLAY_NAMES: string[] = [
  'AceBot',
  'RiverRat',
  'BluffByte',
  'PotOdds',
  'ChipShark',
  'FoldBot',
  'AllInAnnie',
  'NutsNova',
  'CallCart',
  'RaiseRex',
];

/** Seed styles for the default Classic pack (mirrors engine `BOT_NAME_PERSONALITIES`). */
export const DEFAULT_BOT_NAME_PERSONALITIES: Record<string, BotPersonalityId> = {
  AceBot: 'aggro',
  RiverRat: 'caller',
  BluffByte: 'lag',
  PotOdds: 'balanced',
  ChipShark: 'aggro',
  FoldBot: 'nit',
  AllInAnnie: 'maniac',
  NutsNova: 'tight',
  CallCart: 'caller',
  RaiseRex: 'aggro',
};

export const DEFAULT_BOT_GROUPS: BotGroup[] = [
  {
    id: 'classic',
    name: 'Classic',
    names: [...DEFAULT_BOT_DISPLAY_NAMES],
    isDefault: true,
    defaultPersonality: null,
    namePersonalities: { ...DEFAULT_BOT_NAME_PERSONALITIES },
  },
];

/** Table SFX kinds played during a hand (admin-editable URLs). */
export type TableSoundKind =
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'allin'
  | 'deal'
  | 'flop'
  | 'turn'
  | 'river'
  | 'win';

export const TABLE_SOUND_KINDS: readonly TableSoundKind[] = [
  'fold',
  'check',
  'call',
  'bet',
  'raise',
  'allin',
  'deal',
  'flop',
  'turn',
  'river',
  'win',
] as const;

export const DEFAULT_TABLE_SOUND_URLS: Record<TableSoundKind, string> = {
  fold: '/sounds/fold.mp3',
  check: '/sounds/check.mp3',
  call: '/sounds/call.mp3',
  bet: '/sounds/bet.mp3',
  raise: '/sounds/raise.mp3',
  allin: '/sounds/allin.mp3',
  deal: '/sounds/deal.mp3',
  flop: '/sounds/flop.mp3',
  turn: '/sounds/turn.mp3',
  river: '/sounds/river.mp3',
  win: '/sounds/win.mp3',
};

export const MAX_TABLE_SOUND_URL_LEN = 512;

export interface TableSoundsConfig {
  enabled: boolean;
  /** Absolute path or full URL per kind; missing keys fall back to defaults. Empty string disables that kind. */
  urls: Partial<Record<TableSoundKind, string>>;
}

export interface SiteConfigPayload {
  announcement: SiteAnnouncement;
  economy: EconomySnapshot;
  homeFeatures: HomeLandingFeature[];
  pages: PagesCopy;
  rooms: RoomSettings;
  botGroups: BotGroup[];
  sounds: TableSoundsConfig;
}

export const MAX_HOME_FEATURES = 12;

export const BLANK_HOME_FEATURE: HomeLandingFeature = {
  title: 'New feature',
  body: 'Describe this feature for players landing on the home page.',
  cta: 'Learn more',
  href: '/',
  image: '/home-host.png',
  imageAlt: 'POKR feature illustration',
  imageFirst: true,
};

export const DEFAULT_HOME_FEATURES: HomeLandingFeature[] = [
  {
    title: 'Play Contests',
    body: "Knockout tables with no buy-in, where you play until your stack is gone, and fixed-hand games where you choose how many deals run before anyone looks at a card and buy in again whenever you need more chips.",
    cta: 'Browse Contests',
    href: '/contests',
    image: '/home-knockout.png',
    imageAlt: 'Stylish player holding pocket cards at a green felt table',
    imageFirst: true,
  },
  {
    title: 'Open Tables',
    body: "Hold'em that runs the way a home game does, no set number of hands and no cap on buy-ins, so you can add chips whenever your stack runs low and leave when the night feels done.",
    cta: 'Join a Table',
    href: '/join',
    image: '/poker-chip-shuffle.svg',
    imageAlt: 'POKR chips stacking for a fixed-round session',
    imageFirst: false,
  },
  {
    title: 'Community and Social',
    body: 'Add friends by username, gather them into groups for the different circles you play with, and pull a group straight to a table when it is time to deal.',
    cta: 'Play with Friends',
    href: '/friends',
    image: '/home-host.png',
    imageAlt: 'Gloved hand holding a branded chip token',
    imageFirst: true,
  },
  {
    title: 'Challenge 1v1',
    body: 'When you only want one opponent, open your friends list, choose the person, and send a challenge that leaves the table to the two of you and the board between you.',
    cta: 'Challenge a Friend',
    href: '/friends',
    image: '/home-challenge.png',
    imageAlt: 'Two players in a heads-up challenge',
    imageFirst: false,
  },
  {
    title: 'Offline arena',
    body: "Play Hold'em against bots with no connection. Practice lines and timing offline, then jump into live modes when you're ready.",
    cta: 'Offline',
    href: '/solo',
    image: '/home-offline.png',
    imageAlt: 'Stack of red and white chips',
    imageFirst: true,
  },
];

export const PAGE_COPY_KEYS: PageCopyKey[] = [
  'host',
  'join',
  'public',
  'contests',
  'friends',
  'solo',
  'signIn',
  'signUp',
  'homeAuthFooter',
];

export const DEFAULT_PAGES_COPY: PagesCopy = {
  host: {
    title: 'Create a table',
    subtitle:
      "Set stakes and seats, choose starting bots, and open a private Hold'em room with a code you pick or we generate.",
  },
  join: {
    title: 'Join a Table',
    subtitle:
      'Enter the invite code you were sent to take a seat or watch the hand, whether it is a private table or a contest.',
  },
  public: {
    title: 'Public tables',
    subtitle:
      "Open Hold'em at the stakes you choose; sit down when a seat is free or spectate if you would rather watch.",
  },
  contests: {
    title: 'Host Contests',
    subtitle:
      'Host a room for friends in a Knockout freezeout or a fixed run of hands, set the max table size, invite people, and start when the seats look right.',
  },
  friends: {
    title: 'Community and Social',
    subtitle:
      'Find people by username, build groups for the tables you play together, invite a group to sit down, or challenge a friend to heads-up.',
  },
  solo: {
    title: 'Offline Arena',
    subtitle:
      "Train against bots on this device with the same Hold'em rules as live tables, no connection or lobby, and a seat count you choose before the first deal.",
  },
  signIn: {
    title: 'Sign in',
    subtitle: 'Sign in with your username',
  },
  signUp: {
    title: 'Create account',
    subtitle: 'Create a username and password',
  },
  homeAuthFooter: {
    title: 'Ready to play?',
    subtitle: 'Sign in · Create account',
  },
};

export const PAGE_COPY_LABELS: Record<PageCopyKey, string> = {
  host: 'Host (/host)',
  join: 'Join (/join)',
  public: 'Public tables (/public)',
  contests: 'Contests (/contests)',
  friends: 'Friends (/friends)',
  solo: 'Offline setup (/solo)',
  signIn: 'Sign in',
  signUp: 'Sign up',
  homeAuthFooter: 'Home auth footer',
};

export function defaultTableSounds(): TableSoundsConfig {
  return {
    enabled: true,
    urls: { ...DEFAULT_TABLE_SOUND_URLS },
  };
}

export function defaultSiteConfig(): SiteConfigPayload {
  return {
    announcement: { enabled: false, text: '' },
    economy: defaultEconomy(),
    homeFeatures: DEFAULT_HOME_FEATURES.map((f) => ({ ...f })),
    pages: clonePages(DEFAULT_PAGES_COPY),
    rooms: { inactivityMinutes: DEFAULT_ROOM_INACTIVITY_MINUTES },
    botGroups: DEFAULT_BOT_GROUPS.map((g) => cloneBotGroup(g)),
    sounds: defaultTableSounds(),
  };
}

function cloneBotGroup(g: BotGroup): BotGroup {
  return {
    id: g.id,
    name: g.name,
    names: [...g.names],
    isDefault: g.isDefault,
    defaultPersonality: g.defaultPersonality,
    namePersonalities: { ...g.namePersonalities },
  };
}

function normalizeNamePersonalities(
  raw: unknown,
  names: string[],
): Record<string, BotPersonalityId> {
  const out: Record<string, BotPersonalityId> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const map = raw as Record<string, unknown>;
  const byLower = new Map(names.map((n) => [n.toLowerCase(), n] as const));
  for (const [key, value] of Object.entries(map)) {
    if (typeof value !== 'string' || !isBotPersonalityId(value)) continue;
    const canonical = byLower.get(key.trim().toLowerCase());
    if (!canonical) continue;
    out[canonical] = value;
  }
  return out;
}

function slugId(raw: string, fallback: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return s.length > 0 ? s : fallback;
}

function normalizeBotDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, MAX_BOT_DISPLAY_NAME_LEN);
  return t.length > 0 ? t : null;
}

export function normalizeBotGroup(raw: unknown, index: number): BotGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const fallbackId = `group-${index + 1}`;
  const id =
    typeof o.id === 'string' && o.id.trim()
      ? slugId(o.id.trim(), fallbackId)
      : fallbackId;
  const name = asTrimmedString(o.name, MAX_BOT_GROUP_NAME_LEN, `Group ${index + 1}`);
  const namesRaw = Array.isArray(o.names) ? o.names : [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const n of namesRaw) {
    if (names.length >= MAX_BOT_NAMES_PER_GROUP) break;
    const nameStr = normalizeBotDisplayName(n);
    if (!nameStr) continue;
    const key = nameStr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(nameStr);
  }
  if (names.length === 0) {
    names.push(...DEFAULT_BOT_DISPLAY_NAMES);
  }
  const defaultPersonality =
    typeof o.defaultPersonality === 'string' && isBotPersonalityId(o.defaultPersonality)
      ? o.defaultPersonality
      : null;
  const namePersonalities = normalizeNamePersonalities(o.namePersonalities, names);
  // Seed classic-style overrides for groups that never had personality config yet.
  if (
    Object.keys(namePersonalities).length === 0 &&
    o.namePersonalities === undefined &&
    o.defaultPersonality === undefined
  ) {
    for (const n of names) {
      const seed = DEFAULT_BOT_NAME_PERSONALITIES[n];
      if (seed) namePersonalities[n] = seed;
    }
  }
  return {
    id,
    name,
    names,
    isDefault: Boolean(o.isDefault),
    defaultPersonality,
    namePersonalities,
  };
}

export function normalizeBotGroups(raw: unknown): BotGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_BOT_GROUPS.map((g) => cloneBotGroup(g));
  }
  const out: BotGroup[] = [];
  const usedIds = new Set<string>();
  const max = Math.min(raw.length, MAX_BOT_GROUPS);
  for (let i = 0; i < max; i++) {
    const g = normalizeBotGroup(raw[i], i);
    if (!g) continue;
    let id = g.id;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${g.id}-${n++}`.slice(0, 64);
    }
    usedIds.add(id);
    out.push({ ...g, id });
  }
  if (out.length === 0) {
    return DEFAULT_BOT_GROUPS.map((g) => cloneBotGroup(g));
  }
  // Exactly one default: prefer first marked, else first group.
  const defaultIdx = out.findIndex((g) => g.isDefault);
  for (let i = 0; i < out.length; i++) {
    out[i]!.isDefault = i === (defaultIdx >= 0 ? defaultIdx : 0);
  }
  return out;
}

function pickBotGroup(groups: BotGroup[], groupId?: string | null): BotGroup {
  const list = groups.length > 0 ? groups : DEFAULT_BOT_GROUPS;
  if (groupId) {
    const match = list.find((g) => g.id === groupId);
    if (match) return match;
  }
  return list.find((g) => g.isDefault) ?? list[0]!;
}

/** Resolve name list for seating bots (default group if id missing/invalid). */
export function resolveBotNamePool(groups: BotGroup[], groupId?: string | null): string[] {
  return [...pickBotGroup(groups, groupId).names];
}

/** Name pool + personality settings for seating bots from a group. */
export function resolveBotSeatingConfig(
  groups: BotGroup[],
  groupId?: string | null,
): BotSeatingConfig {
  const g = pickBotGroup(groups, groupId);
  return {
    names: [...g.names],
    defaultPersonality: g.defaultPersonality,
    namePersonalities: { ...g.namePersonalities },
  };
}

function clonePages(pages: PagesCopy): PagesCopy {
  const out = {} as PagesCopy;
  for (const key of PAGE_COPY_KEYS) {
    out[key] = { ...pages[key] };
  }
  return out;
}

function clampPositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  return n > 0 ? n : fallback;
}

/** Non-negative int (allows 0), e.g. starting Whuffies. */
function clampNonNegInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return Math.max(0, Math.floor(fallback));
  const n = Math.floor(value);
  return n >= 0 ? n : Math.max(0, Math.floor(fallback));
}

function asTrimmedString(value: unknown, max: number, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const t = value.trim().slice(0, max);
  return t.length > 0 ? t : fallback;
}

function normalizeHref(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const t = value.trim().slice(0, 500);
  if (!t) return fallback;
  if (t.startsWith('/') || /^https:\/\//i.test(t)) return t;
  return fallback;
}

export function normalizeHomeFeature(
  raw: unknown,
  fallback: HomeLandingFeature = BLANK_HOME_FEATURE,
): HomeLandingFeature {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    title: asTrimmedString(o.title, 120, fallback.title),
    body: asTrimmedString(o.body, 2000, fallback.body),
    cta: asTrimmedString(o.cta, 80, fallback.cta),
    href: normalizeHref(o.href, fallback.href),
    image: asTrimmedString(o.image, 500, fallback.image),
    imageAlt: asTrimmedString(o.imageAlt, 200, fallback.imageAlt),
    imageFirst: typeof o.imageFirst === 'boolean' ? o.imageFirst : fallback.imageFirst,
  };
}

export function normalizeHomeFeatures(raw: unknown): HomeLandingFeature[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_HOME_FEATURES.map((f) => ({ ...f }));
  }
  const max = Math.min(raw.length, MAX_HOME_FEATURES);
  const out: HomeLandingFeature[] = [];
  for (let i = 0; i < max; i++) {
    const fallback =
      DEFAULT_HOME_FEATURES[i] ??
      DEFAULT_HOME_FEATURES[DEFAULT_HOME_FEATURES.length - 1] ??
      BLANK_HOME_FEATURE;
    out.push(normalizeHomeFeature(raw[i], fallback));
  }
  return out.length > 0 ? out : DEFAULT_HOME_FEATURES.map((f) => ({ ...f }));
}

export function normalizePageCopy(raw: unknown, fallback: PageCopy): PageCopy {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const o = raw as Record<string, unknown>;
  return {
    title: asTrimmedString(o.title, 200, fallback.title),
    subtitle: asTrimmedString(o.subtitle, 2000, fallback.subtitle),
  };
}

export function normalizePagesCopy(raw: unknown): PagesCopy {
  const defaults = clonePages(DEFAULT_PAGES_COPY);
  if (!raw || typeof raw !== 'object') return defaults;
  const o = raw as Record<string, unknown>;
  const out = {} as PagesCopy;
  for (const key of PAGE_COPY_KEYS) {
    out[key] = normalizePageCopy(o[key], defaults[key]);
  }
  return out;
}

export function normalizeRoomSettings(raw: unknown): RoomSettings {
  const defaults: RoomSettings = { inactivityMinutes: DEFAULT_ROOM_INACTIVITY_MINUTES };
  if (!raw || typeof raw !== 'object') return defaults;
  const o = raw as Record<string, unknown>;
  let minutes = defaults.inactivityMinutes;
  if (typeof o.inactivityMinutes === 'number' && Number.isFinite(o.inactivityMinutes)) {
    minutes = Math.floor(o.inactivityMinutes);
  }
  if (minutes < MIN_ROOM_INACTIVITY_MINUTES) minutes = MIN_ROOM_INACTIVITY_MINUTES;
  if (minutes > MAX_ROOM_INACTIVITY_MINUTES) minutes = MAX_ROOM_INACTIVITY_MINUTES;
  return { inactivityMinutes: minutes };
}

function isAllowedSoundUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Merge overrides with defaults; empty string keeps that kind disabled. */
export function normalizeTableSounds(raw: unknown): TableSoundsConfig {
  const defaults = defaultTableSounds();
  if (!raw || typeof raw !== 'object') return defaults;
  const o = raw as Record<string, unknown>;
  const enabled = o.enabled === undefined ? true : Boolean(o.enabled);
  const urls: Partial<Record<TableSoundKind, string>> = { ...defaults.urls };
  const rawUrls = o.urls;
  if (rawUrls && typeof rawUrls === 'object') {
    const src = rawUrls as Record<string, unknown>;
    for (const kind of TABLE_SOUND_KINDS) {
      if (!(kind in src)) continue;
      const v = src[kind];
      if (typeof v !== 'string') continue;
      const trimmed = v.trim().slice(0, MAX_TABLE_SOUND_URL_LEN);
      if (trimmed === '') {
        urls[kind] = '';
        continue;
      }
      if (isAllowedSoundUrl(trimmed)) {
        urls[kind] = trimmed;
      }
    }
  }
  return { enabled, urls };
}

export function normalizeSiteConfig(raw: unknown): SiteConfigPayload {
  const defaults = defaultSiteConfig();
  if (!raw || typeof raw !== 'object') return defaults;
  const o = raw as Record<string, unknown>;

  let announcement = defaults.announcement;
  if (o.announcement && typeof o.announcement === 'object') {
    const a = o.announcement as Record<string, unknown>;
    announcement = {
      enabled: Boolean(a.enabled),
      text: typeof a.text === 'string' ? a.text.slice(0, 2000) : '',
    };
  }

  let economy = defaults.economy;
  if (o.economy && typeof o.economy === 'object') {
    const e = o.economy as Record<string, unknown>;
    economy = {
      startingChipGrant: clampPositiveInt(e.startingChipGrant, STARTING_CHIP_GRANT),
      refillThreshold: clampPositiveInt(e.refillThreshold, REFILL_THRESHOLD),
      refillGrant: clampPositiveInt(e.refillGrant, REFILL_GRANT),
      startingWhuffieGrant: clampNonNegInt(e.startingWhuffieGrant, STARTING_WHUFFIE_GRANT),
    };
  }

  const homeFeatures =
    o.homeFeatures !== undefined ? normalizeHomeFeatures(o.homeFeatures) : defaults.homeFeatures;

  const pages = o.pages !== undefined ? normalizePagesCopy(o.pages) : defaults.pages;

  const rooms = o.rooms !== undefined ? normalizeRoomSettings(o.rooms) : defaults.rooms;

  const botGroups =
    o.botGroups !== undefined ? normalizeBotGroups(o.botGroups) : defaults.botGroups;

  const sounds = o.sounds !== undefined ? normalizeTableSounds(o.sounds) : defaults.sounds;

  return { announcement, economy, homeFeatures, pages, rooms, botGroups, sounds };
}
