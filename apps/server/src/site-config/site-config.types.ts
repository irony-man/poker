import {
  defaultEconomy,
  type EconomySnapshot,
  REFILL_GRANT,
  REFILL_THRESHOLD,
  STARTING_CHIP_GRANT,
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

export const DEFAULT_ROOM_INACTIVITY_MINUTES = 15;
/** Floor for admin control (at least 1 minute). */
export const MIN_ROOM_INACTIVITY_MINUTES = 1;
/** Cap at 24 hours. */
export const MAX_ROOM_INACTIVITY_MINUTES = 24 * 60;

export interface SiteConfigPayload {
  announcement: SiteAnnouncement;
  economy: EconomySnapshot;
  homeFeatures: HomeLandingFeature[];
  pages: PagesCopy;
  rooms: RoomSettings;
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
    body: "Knockout tables with no buy-in, where you play until your stack is gone, and fixed-hand games where you choose how many deals run before anyone looks at a card and buy in again whenever you need more Wuffies.",
    cta: 'Browse Contests',
    href: '/contests',
    image: '/home-knockout.png',
    imageAlt: 'Stylish player holding pocket cards at a green felt table',
    imageFirst: true,
  },
  {
    title: 'Open Tables',
    body: "Hold'em that runs the way a home game does, no set number of hands and no cap on buy-ins, so you can add Wuffies whenever your stack runs low and leave when the night feels done.",
    cta: 'Join a Table',
    href: '/join',
    image: '/poker-chip-shuffle.svg',
    imageAlt: 'POKR Wuffies stacking for a fixed-round session',
    imageFirst: false,
  },
  {
    title: 'Community and Social',
    body: 'Add friends by username, gather them into groups for the different circles you play with, and pull a group straight to a table when it is time to deal.',
    cta: 'Play with Friends',
    href: '/friends',
    image: '/home-host.png',
    imageAlt: 'Gloved hand holding a branded Wuffie token',
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
    imageAlt: 'Stack of red and white Wuffies',
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

export function defaultSiteConfig(): SiteConfigPayload {
  return {
    announcement: { enabled: false, text: '' },
    economy: defaultEconomy(),
    homeFeatures: DEFAULT_HOME_FEATURES.map((f) => ({ ...f })),
    pages: clonePages(DEFAULT_PAGES_COPY),
    rooms: { inactivityMinutes: DEFAULT_ROOM_INACTIVITY_MINUTES },
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
    };
  }

  const homeFeatures =
    o.homeFeatures !== undefined ? normalizeHomeFeatures(o.homeFeatures) : defaults.homeFeatures;

  const pages = o.pages !== undefined ? normalizePagesCopy(o.pages) : defaults.pages;

  const rooms = o.rooms !== undefined ? normalizeRoomSettings(o.rooms) : defaults.rooms;

  return { announcement, economy, homeFeatures, pages, rooms };
}
