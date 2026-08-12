import type { PagesCopy } from '@/lib/pageCopy';
import { API_URL, parseError } from './client';
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

export type { PageCopy, PageCopyKey, PagesCopy } from '@/lib/pageCopy';

export async function fetchPublicSite(): Promise<{
  announcement: SiteAnnouncement;
  homeFeatures?: HomeLandingFeature[];
  pages?: PagesCopy;
  botGroups?: PublicBotGroup[];
  sounds?: TableSoundsConfig;
}> {
  const res = await fetch(`${API_URL}/api/site`);
  if (!res.ok) throw new Error(await parseError(res, 'Could not load site'));
  return res.json() as Promise<{
    announcement: SiteAnnouncement;
    homeFeatures?: HomeLandingFeature[];
    pages?: PagesCopy;
    botGroups?: PublicBotGroup[];
    sounds?: TableSoundsConfig;
  }>;
}

export async function fetchPublicBotGroups(): Promise<PublicBotGroup[]> {
  try {
    const site = await fetchPublicSite();
    return site.botGroups ?? [];
  } catch {
    return [];
  }
}
