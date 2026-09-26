import type { PagesCopy } from '@/lib/pageCopy';
import { apiBase, parseError } from './client';
import type { BotGroupLabels, PublicBotGroup } from './admin';
import { DEFAULT_BOT_GROUP_LABELS } from './admin';
import type { TableSoundsConfig } from './sounds';

export interface SiteAnnouncement {
  enabled: boolean;
  text: string;
}

export interface SiteEconomy {
  startingChipGrant: number;
  refillThreshold: number;
  refillGrant: number;
  startingWhuffieGrant: number;
}

export interface HomeLandingFeature {
  title: string;
  body: string;
  cta: string;
  href: string;
  image: string;
  imageAlt: string;
  imageFirst: boolean;
}

export type CopyTheme = 'v1' | 'v2';

export interface PagesByTheme {
  v1: PagesCopy;
  v2: PagesCopy;
}

export interface HomeFeaturesByTheme {
  v1: HomeLandingFeature[];
  v2: HomeLandingFeature[];
}

export type { PageCopy, PageCopyKey, PagesCopy } from '@/lib/pageCopy';

export type AvatarPresetsConfig = {
  urls: string[];
};

export type { CardFaceTheme } from '@/lib/cardFaceTheme';

export type PublicSitePayload = {
  announcement: SiteAnnouncement;
  homeFeatures?: HomeLandingFeature[];
  pages?: PagesCopy;
  homeFeaturesByTheme?: HomeFeaturesByTheme;
  pagesByTheme?: PagesByTheme;
  botGroups?: PublicBotGroup[];
  botGroupLabels?: BotGroupLabels;
  sounds?: TableSoundsConfig;
  avatarPresets?: AvatarPresetsConfig;
  cardThemes?: import('@/lib/cardFaceTheme').CardFaceTheme[];
};

export { DEFAULT_AVATAR_PRESET_URLS } from '@/lib/avatars';

export type PublicBotGroupsResult = {
  groups: PublicBotGroup[];
  labels: BotGroupLabels;
};

const SITE_CACHE_TTL_MS = 60_000;
let siteCache: { at: number; data: PublicSitePayload } | null = null;
let siteInflight: Promise<PublicSitePayload> | null = null;

/** Shared /api/site fetch — coalesces concurrent callers and caches briefly. */
export async function fetchPublicSite(): Promise<PublicSitePayload> {
  const now = Date.now();
  if (siteCache && now - siteCache.at < SITE_CACHE_TTL_MS) {
    return siteCache.data;
  }
  if (siteInflight) return siteInflight;

  siteInflight = (async () => {
    const res = await fetch(`${apiBase()}/api/site`);
    if (!res.ok) throw new Error(await parseError(res, 'Could not load site'));
    const data = (await res.json()) as PublicSitePayload;
    siteCache = { at: Date.now(), data };
    return data;
  })().finally(() => {
    siteInflight = null;
  });

  return siteInflight;
}

export async function fetchPublicBotGroups(): Promise<PublicBotGroup[]> {
  const { groups } = await fetchPublicBotGroupsWithLabels();
  return groups;
}

export async function fetchPublicBotGroupsWithLabels(): Promise<PublicBotGroupsResult> {
  try {
    const site = await fetchPublicSite();
    return {
      groups: site.botGroups ?? [],
      labels: coercePublicBotGroupLabels(site.botGroupLabels),
    };
  } catch {
    return { groups: [], labels: [...DEFAULT_BOT_GROUP_LABELS] };
  }
}

function coercePublicBotGroupLabels(raw: unknown): BotGroupLabels {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((l, i) => {
      const o = l && typeof l === 'object' ? (l as Record<string, unknown>) : {};
      const id = String(o.id ?? '').trim() || `label-${i + 1}`;
      const name = String(o.name ?? '').trim() || id;
      return { id, name };
    });
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if ('level' in o || 'groups' in o || 'movies' in o) {
      return [
        {
          id: 'level',
          name:
            typeof o.level === 'string' && o.level.trim() ? o.level.trim() : 'Level',
        },
        {
          id: 'groups',
          name:
            typeof o.groups === 'string' && o.groups.trim() ? o.groups.trim() : 'Groups',
        },
        {
          id: 'movies',
          name:
            typeof o.movies === 'string' && o.movies.trim() ? o.movies.trim() : 'Movies',
        },
      ];
    }
  }
  return [...DEFAULT_BOT_GROUP_LABELS];
}
