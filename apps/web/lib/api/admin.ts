import type { ContestView } from '@poker/protocol';
import type { PagesCopy } from '@/lib/pageCopy';
import { apiBase, authedFetch, parseError, sessionHeaders } from './client';
import type {
  CopyTheme,
  HomeFeaturesByTheme,
  HomeLandingFeature,
  PagesByTheme,
  SiteAnnouncement,
  SiteEconomy,
} from './site';
import type { TableSoundKind, TableSoundsConfig } from './sounds';

export interface AdminUserRow {
  id: string;
  username: string;
  name: string;
  avatarId: number;
  chipBalance: number;
  whuffieBalance: number;
  createdAt: number;
}

export interface AdminTableRow {
  tableId: string;
  inviteCode: string;
  name: string;
  isPrivate: boolean;
  stakeId: string | null;
  seatedCount: number;
  maxSeats: number;
  hostUserId: string;
  handInProgress: boolean;
  street?: string;
  idle: boolean;
  playMoney: boolean;
  contestId: string | null;
  contestFrozen?: boolean;
  createdAt: number;
}

export type AdminContestRow = ContestView & {
  tableSeatedCount?: number;
  activePlayers?: number;
  eliminatedCount?: number;
};

export interface AdminRoomSettings {
  inactivityMinutes: number;
}

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

export interface BotGroup {
  id: string;
  name: string;
  names: string[];
  isDefault: boolean;
  /** Group style when a name has no override; null = auto (engine by name/hash). */
  defaultPersonality: BotPersonalityId | null;
  /** Per display-name style overrides. */
  namePersonalities: Record<string, BotPersonalityId>;
}

/** Public list of bot groups for host / table / offline. */
export interface PublicBotGroup {
  id: string;
  name: string;
  isDefault: boolean;
  nameCount: number;
  /** Display names used when seating bots (offline needs these client-side). */
  names?: string[];
  defaultPersonality?: BotPersonalityId | null;
  namePersonalities?: Record<string, BotPersonalityId>;
}

export async function fetchAdminHomeFeatures(sessionToken: string) {
  return authedFetch('/api/admin/home-features', { sessionToken }) as Promise<{
    features: HomeLandingFeature[];
    featuresByTheme?: HomeFeaturesByTheme;
  }>;
}

export async function patchAdminHomeFeatures(
  sessionToken: string,
  features: HomeLandingFeature[],
  theme: CopyTheme = 'v1',
): Promise<{
  features: HomeLandingFeature[];
  theme?: CopyTheme;
  featuresByTheme?: HomeFeaturesByTheme;
}> {
  return authedFetch('/api/admin/home-features', {
    sessionToken,
    method: 'PATCH',
    body: { features, theme },
  }) as Promise<{
    features: HomeLandingFeature[];
    theme?: CopyTheme;
    featuresByTheme?: HomeFeaturesByTheme;
  }>;
}

export async function fetchAdminPages(sessionToken: string) {
  return authedFetch('/api/admin/pages', { sessionToken }) as Promise<{
    pages: PagesCopy;
    pagesByTheme?: PagesByTheme;
  }>;
}

export async function patchAdminPages(
  sessionToken: string,
  pages: PagesCopy,
  theme: CopyTheme = 'v1',
): Promise<{ pages: PagesCopy; theme?: CopyTheme; pagesByTheme?: PagesByTheme }> {
  return authedFetch('/api/admin/pages', {
    sessionToken,
    method: 'PATCH',
    body: { pages, theme },
  }) as Promise<{ pages: PagesCopy; theme?: CopyTheme; pagesByTheme?: PagesByTheme }>;
}

export async function fetchAdminOverview(sessionToken: string) {
  return authedFetch('/api/admin/overview', { sessionToken }) as Promise<{
    userCount: number;
    economy: SiteEconomy;
    announcement: SiteAnnouncement;
    liveTables: number;
    liveContests: number;
    pagesByTheme?: PagesByTheme;
    homeFeaturesByTheme?: HomeFeaturesByTheme;
  }>;
}

export async function fetchAdminAnnouncement(sessionToken: string) {
  return authedFetch('/api/admin/announcement', { sessionToken }) as Promise<SiteAnnouncement>;
}

export async function patchAdminAnnouncement(
  sessionToken: string,
  body: SiteAnnouncement,
): Promise<SiteAnnouncement> {
  return authedFetch('/api/admin/announcement', {
    sessionToken,
    method: 'PATCH',
    body,
  }) as Promise<SiteAnnouncement>;
}

export async function fetchAdminEconomy(sessionToken: string) {
  return authedFetch('/api/admin/economy', { sessionToken }) as Promise<SiteEconomy>;
}

export async function patchAdminEconomy(
  sessionToken: string,
  body: Partial<SiteEconomy>,
): Promise<SiteEconomy> {
  return authedFetch('/api/admin/economy', {
    sessionToken,
    method: 'PATCH',
    body,
  }) as Promise<SiteEconomy>;
}

export async function fetchAdminRoomSettings(sessionToken: string) {
  return authedFetch('/api/admin/room-settings', { sessionToken }) as Promise<AdminRoomSettings>;
}

export async function patchAdminRoomSettings(
  sessionToken: string,
  body: AdminRoomSettings,
): Promise<AdminRoomSettings> {
  return authedFetch('/api/admin/room-settings', {
    sessionToken,
    method: 'PATCH',
    body,
  }) as Promise<AdminRoomSettings>;
}

export async function fetchAdminUsers(sessionToken: string, q?: string) {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return authedFetch(`/api/admin/users${qs}`, { sessionToken }) as Promise<{
    users: AdminUserRow[];
  }>;
}

export async function creditAdminUser(
  sessionToken: string,
  userId: string,
  amount: number,
): Promise<{ ok: true; userId: string; username: string; balance: number; credited: number }> {
  return authedFetch(`/api/admin/users/${encodeURIComponent(userId)}/credit`, {
    sessionToken,
    method: 'POST',
    body: { amount },
  }) as Promise<{
    ok: true;
    userId: string;
    username: string;
    balance: number;
    credited: number;
  }>;
}

export async function resetAdminUserChips(
  sessionToken: string,
  userId: string,
): Promise<{
  ok: true;
  userId: string;
  username: string;
  balance: number;
  previousBalance: number;
  resetTo: number;
}> {
  return authedFetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-chips`, {
    sessionToken,
    method: 'POST',
    body: {},
  }) as Promise<{
    ok: true;
    userId: string;
    username: string;
    balance: number;
    previousBalance: number;
    resetTo: number;
  }>;
}

export async function creditAdminUserWhuffies(
  sessionToken: string,
  userId: string,
  amount: number,
): Promise<{ ok: true; userId: string; username: string; balance: number; credited: number }> {
  return authedFetch(`/api/admin/users/${encodeURIComponent(userId)}/credit-whuffies`, {
    sessionToken,
    method: 'POST',
    body: { amount },
  }) as Promise<{
    ok: true;
    userId: string;
    username: string;
    balance: number;
    credited: number;
  }>;
}

export async function resetAdminUserWhuffies(
  sessionToken: string,
  userId: string,
): Promise<{
  ok: true;
  userId: string;
  username: string;
  balance: number;
  previousBalance: number;
  resetTo: number;
}> {
  return authedFetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-whuffies`, {
    sessionToken,
    method: 'POST',
    body: {},
  }) as Promise<{
    ok: true;
    userId: string;
    username: string;
    balance: number;
    previousBalance: number;
    resetTo: number;
  }>;
}

export async function deleteAdminUser(
  sessionToken: string,
  userId: string,
): Promise<{ ok: true; userId: string; username: string }> {
  return authedFetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    sessionToken,
    method: 'DELETE',
  }) as Promise<{ ok: true; userId: string; username: string }>;
}

export async function fetchAdminGames(sessionToken: string) {
  return authedFetch('/api/admin/games', { sessionToken }) as Promise<{
    tables: AdminTableRow[];
    contests: AdminContestRow[];
  }>;
}

export async function fetchAdminBotGroups(sessionToken: string) {
  return authedFetch('/api/admin/bot-groups', { sessionToken }) as Promise<{
    groups: BotGroup[];
  }>;
}

export async function patchAdminBotGroups(
  sessionToken: string,
  groups: BotGroup[],
): Promise<{ groups: BotGroup[] }> {
  return authedFetch('/api/admin/bot-groups', {
    sessionToken,
    method: 'PATCH',
    body: { groups },
  }) as Promise<{ groups: BotGroup[] }>;
}

export async function fetchAdminSounds(sessionToken: string): Promise<TableSoundsConfig> {
  return authedFetch('/api/admin/sounds', { sessionToken }) as Promise<TableSoundsConfig>;
}

export async function patchAdminSounds(
  sessionToken: string,
  body: TableSoundsConfig,
): Promise<TableSoundsConfig> {
  return authedFetch('/api/admin/sounds', {
    sessionToken,
    method: 'PATCH',
    body,
  }) as Promise<TableSoundsConfig>;
}

export async function requestAdminSoundUploadUrl(
  sessionToken: string,
  body: {
    kind: TableSoundKind;
    contentType: 'audio/mpeg' | 'audio/mp3';
    contentLength: number;
  },
): Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }> {
  const res = await fetch(`${apiBase()}/api/admin/sounds/upload-url`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not start sound upload'));
  return res.json() as Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }>;
}

export type SiteImagePurpose =
  | 'home'
  | 'host'
  | 'join'
  | 'public'
  | 'contests'
  | 'friends'
  | 'solo'
  | 'signIn'
  | 'signUp';

export async function requestAdminImageUploadUrl(
  sessionToken: string,
  body: {
    purpose: SiteImagePurpose;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
    contentLength: number;
  },
): Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }> {
  const res = await fetch(`${apiBase()}/api/admin/images/upload-url`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not start image upload'));
  return res.json() as Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }>;
}

export interface AdminHandWinner {
  seat: number;
  amount: number;
  name?: string;
  handName?: string;
}

export interface AdminHandSummary {
  id: string;
  tableId: string;
  handId: string;
  contestId: string | null;
  source: string;
  startedAt: string;
  endedAt: string | null;
  playerNames: string[];
  winners: AdminHandWinner[];
}

export interface AdminHandsPage {
  items: AdminHandSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminHandDetail {
  hand: AdminHandSummary & {
    resultJson?: string;
    result: unknown;
  };
}

export async function fetchAdminHands(
  sessionToken: string,
  opts: { page?: number; pageSize?: number; source?: string; tableId?: string; q?: string } = {},
): Promise<AdminHandsPage> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
  if (opts.source) params.set('source', opts.source);
  if (opts.tableId) params.set('tableId', opts.tableId);
  if (opts.q) params.set('q', opts.q);
  const qs = params.toString();
  return authedFetch(`/api/admin/hands${qs ? `?${qs}` : ''}`, { sessionToken }) as Promise<AdminHandsPage>;
}

export async function fetchAdminHand(sessionToken: string, id: string): Promise<AdminHandDetail> {
  return authedFetch(`/api/admin/hands/${encodeURIComponent(id)}`, {
    sessionToken,
  }) as Promise<AdminHandDetail>;
}
