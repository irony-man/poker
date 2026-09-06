import type { PagesCopy } from '@/lib/pageCopy';
import { apiBase, parseError } from './client';
import type { PublicBotGroup } from './admin';
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

export type PublicSitePayload = {
  announcement: SiteAnnouncement;
  homeFeatures?: HomeLandingFeature[];
  pages?: PagesCopy;
  homeFeaturesByTheme?: HomeFeaturesByTheme;
  pagesByTheme?: PagesByTheme;
  botGroups?: PublicBotGroup[];
  sounds?: TableSoundsConfig;
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
  try {
    const site = await fetchPublicSite();
    return site.botGroups ?? [];
  } catch {
    return [];
  }
}
