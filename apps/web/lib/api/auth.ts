import type { AuthSession } from '@poker/protocol';
import { coerceMoney } from '@/lib/currency';
import { clampTableColorId } from '@/lib/tableColors';
import { clampTableLayout, type TableLayout } from '@/lib/tableLayoutPref';
import { clampUiTheme, type UiTheme } from '@/lib/uiTheme';
import { apiBase, parseError, sessionHeaders } from './client';

export interface MeProfile {
  id: string;
  username: string;
  name: string;
  avatarId: number;
  avatarUrl: string | null;
  tableColorId: number;
  uiTheme: UiTheme;
  tableLayout: TableLayout;
  sfxMuted: boolean;
  createdAt: number;
  chipBalance: number;
  whuffieBalance: number;
  handsPlayed: number;
  friendCount: number;
  isAdmin?: boolean;
}

function normalizeMe(data: MeProfile): MeProfile {
  return {
    ...data,
    chipBalance: coerceMoney(data.chipBalance),
    whuffieBalance: coerceMoney(data.whuffieBalance),
    handsPlayed:
      typeof data.handsPlayed === 'number' && Number.isFinite(data.handsPlayed)
        ? Math.max(0, Math.floor(data.handsPlayed))
        : 0,
    friendCount:
      typeof data.friendCount === 'number' && Number.isFinite(data.friendCount)
        ? Math.max(0, Math.floor(data.friendCount))
        : 0,
    avatarId:
      typeof data.avatarId === 'number' && Number.isFinite(data.avatarId)
        ? Math.max(0, Math.floor(data.avatarId))
        : 0,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
    tableColorId: clampTableColorId(
      typeof data.tableColorId === 'number' && Number.isFinite(data.tableColorId)
        ? Math.floor(data.tableColorId)
        : 0,
    ),
    uiTheme: clampUiTheme(data.uiTheme),
    tableLayout: clampTableLayout(data.tableLayout),
    sfxMuted: data.sfxMuted === true,
  };
}

export async function signup(
  username: string,
  password: string,
  avatarId?: number,
): Promise<AuthSession> {
  const res = await fetch(`${apiBase()}/api/signup`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ username, password, avatarId }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Signup failed'));
  return res.json() as Promise<AuthSession>;
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const res = await fetch(`${apiBase()}/api/login`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Login failed'));
  return res.json() as Promise<AuthSession>;
}

export async function logout(sessionToken: string): Promise<void> {
  await fetch(`${apiBase()}/api/logout`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
  });
}

export async function refreshTicket(sessionToken: string): Promise<{
  ticket: string;
  userId: string;
  name: string;
  username: string;
  avatarId: number;
  chipBalance?: number;
  whuffieBalance?: number;
}> {
  const res = await fetch(`${apiBase()}/api/ticket`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Session expired'));
  return res.json();
}

export async function fetchMe(sessionToken: string): Promise<MeProfile> {
  const res = await fetch(`${apiBase()}/api/me`, {
    method: 'GET',
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not load profile'));
  return normalizeMe((await res.json()) as MeProfile);
}

export async function updateMe(
  sessionToken: string,
  body: {
    avatarId?: number;
    avatarUrl?: string | null;
    tableColorId?: number;
    uiTheme?: UiTheme;
    tableLayout?: TableLayout;
    sfxMuted?: boolean;
  },
): Promise<MeProfile> {
  const res = await fetch(`${apiBase()}/api/me`, {
    method: 'PATCH',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not update profile'));
  return normalizeMe((await res.json()) as MeProfile);
}

export async function requestAvatarUploadUrl(
  sessionToken: string,
  body: { contentType: 'image/jpeg' | 'image/png' | 'image/webp'; contentLength: number },
): Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }> {
  const res = await fetch(`${apiBase()}/api/me/avatar/upload-url`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not start avatar upload'));
  return res.json() as Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }>;
}
