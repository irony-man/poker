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

export interface SiteConfigPayload {
  announcement: SiteAnnouncement;
  economy: EconomySnapshot;
  homeFeatures: HomeLandingFeature[];
}

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

export function defaultSiteConfig(): SiteConfigPayload {
  return {
    announcement: { enabled: false, text: '' },
    economy: defaultEconomy(),
    homeFeatures: DEFAULT_HOME_FEATURES.map((f) => ({ ...f })),
  };
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
  // Internal app path or absolute https URL
  if (t.startsWith('/') || /^https:\/\//i.test(t)) return t;
  return fallback;
}

export function normalizeHomeFeature(
  raw: unknown,
  fallback: HomeLandingFeature = DEFAULT_HOME_FEATURES[0]!,
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
  const max = Math.min(raw.length, 8);
  const out: HomeLandingFeature[] = [];
  for (let i = 0; i < max; i++) {
    const fallback = DEFAULT_HOME_FEATURES[i] ?? DEFAULT_HOME_FEATURES[DEFAULT_HOME_FEATURES.length - 1]!;
    out.push(normalizeHomeFeature(raw[i], fallback));
  }
  return out.length > 0 ? out : DEFAULT_HOME_FEATURES.map((f) => ({ ...f }));
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

  return { announcement, economy, homeFeatures };
}
