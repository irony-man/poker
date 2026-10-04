import type { AuthSession, GoogleNeedsUsername, InstagramNeedsUsername } from '@poker/protocol';
import { coerceMoney } from '@/lib/currency';
import { clampTableColorId } from '@/lib/tableColors';
import { clampTableLayout, type TableLayout } from '@/lib/tableLayoutPref';
import { clampUiTheme, type UiTheme } from '@/lib/uiTheme';
import {
  clampKeyboardShortcuts,
  type KeyboardShortcuts,
} from '@/lib/keyboardShortcuts';
import { apiBase, apiFetch, failFromResponse, parseError, sessionHeaders } from './client';

export interface MeProfile {
  id: string;
  username: string;
  name: string;
  avatarId: number;
  avatarUrl: string | null;
  tableColorId: number;
  cardThemeId: string;
  uiTheme: UiTheme;
  tableLayout: TableLayout;
  sfxMuted: boolean;
  keyboardShortcuts: KeyboardShortcuts;
  /** Recovery email; only verified emails receive password reset links. */
  email: string | null;
  emailVerified: boolean;
  googleLinked: boolean;
  instagramLinked: boolean;
  hasPassword: boolean;
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
    cardThemeId:
      typeof data.cardThemeId === 'string' && data.cardThemeId.trim()
        ? data.cardThemeId.trim().slice(0, 64)
        : 'classic',
    uiTheme: clampUiTheme(data.uiTheme),
    tableLayout: clampTableLayout(data.tableLayout),
    sfxMuted: data.sfxMuted === true,
    keyboardShortcuts: clampKeyboardShortcuts(data.keyboardShortcuts ?? {}),
    email: typeof data.email === 'string' && data.email ? data.email : null,
    emailVerified: data.emailVerified === true,
    googleLinked: data.googleLinked === true,
    instagramLinked: data.instagramLinked === true,
    hasPassword: data.hasPassword !== false,
  };
}

let authConfigPromise: Promise<{
  googleClientId: string | null;
  instagramEnabled: boolean;
}> | null = null;

/** Public auth options (cached for the page lifetime). */
export function fetchAuthConfig(): Promise<{
  googleClientId: string | null;
  instagramEnabled: boolean;
}> {
  if (!authConfigPromise) {
    authConfigPromise = apiFetch(`${apiBase()}/api/auth/config`, { silent: true })
      .then(async (res) => {
        if (!res.ok) return { googleClientId: null, instagramEnabled: false };
        const data = (await res.json()) as { googleClientId?: unknown; instagramEnabled?: unknown };
        return {
          googleClientId:
            typeof data.googleClientId === 'string' && data.googleClientId
              ? data.googleClientId
              : null,
          instagramEnabled: data.instagramEnabled === true,
        };
      })
      .catch(() => {
        authConfigPromise = null;
        return { googleClientId: null, instagramEnabled: false };
      });
  }
  return authConfigPromise;
}

export type GoogleAuthResult = AuthSession | GoogleNeedsUsername;

export function isGoogleNeedsUsername(r: GoogleAuthResult): r is GoogleNeedsUsername {
  return (r as GoogleNeedsUsername).needsUsername === true;
}

export async function googleAuth(
  idToken: string,
  opts: { username?: string; avatarId?: number } = {},
): Promise<GoogleAuthResult> {
  const res = await apiFetch(`${apiBase()}/api/auth/google`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ idToken, ...opts }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Google sign-in failed'));
  return res.json() as Promise<GoogleAuthResult>;
}

export type InstagramAuthResult =
  | (AuthSession & { next?: string })
  | InstagramNeedsUsername
  | { linked: true; next?: string };

export function isInstagramNeedsUsername(r: InstagramAuthResult): r is InstagramNeedsUsername {
  return (r as InstagramNeedsUsername).needsUsername === true;
}

export function isInstagramLinked(r: InstagramAuthResult): r is { linked: true } {
  return (r as { linked?: boolean }).linked === true;
}

export async function startInstagramAuth(opts: {
  next?: string;
  intent?: 'login' | 'link';
  sessionToken?: string;
}): Promise<string> {
  const params = new URLSearchParams();
  if (opts.next) params.set('next', opts.next);
  if (opts.intent) params.set('intent', opts.intent);
  const qs = params.toString();
  const res = await apiFetch(`${apiBase()}/api/auth/instagram/start${qs ? `?${qs}` : ''}`, {
    headers: sessionHeaders(opts.sessionToken),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Instagram sign-in is not available'));
  const data = (await res.json()) as { url?: unknown };
  if (typeof data.url !== 'string' || !data.url) {
    throw new Error('Instagram sign-in is not available');
  }
  return data.url;
}

export async function instagramAuth(
  body: {
    code?: string;
    state?: string;
    pendingToken?: string;
    username?: string;
    avatarId?: number;
  },
  sessionToken?: string,
): Promise<InstagramAuthResult> {
  const res = await apiFetch(`${apiBase()}/api/auth/instagram`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Instagram sign-in failed'));
  return res.json() as Promise<InstagramAuthResult>;
}

export async function unlinkInstagram(sessionToken: string): Promise<MeProfile> {
  const res = await apiFetch(`${apiBase()}/api/me/instagram`, {
    method: 'DELETE',
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) await failFromResponse(res, 'Could not disconnect Instagram');
  return normalizeMe((await res.json()) as MeProfile);
}

export async function forgotPassword(identifier: string): Promise<void> {
  const res = await apiFetch(`${apiBase()}/api/auth/forgot-password`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ identifier }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not send reset email'));
}

/** Whether a reset link can still be used (does not consume it). */
export async function checkResetToken(token: string): Promise<boolean> {
  const res = await apiFetch(`${apiBase()}/api/auth/reset-password/check`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not check reset link'));
  const data = (await res.json()) as { valid?: boolean };
  return data.valid === true;
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ username: string }> {
  const res = await apiFetch(`${apiBase()}/api/auth/reset-password`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not reset password'));
  return res.json() as Promise<{ username: string }>;
}

export async function verifyEmail(token: string): Promise<{ email: string | null }> {
  const res = await apiFetch(`${apiBase()}/api/auth/verify-email`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Could not verify email'));
  return res.json() as Promise<{ email: string | null }>;
}

export async function setRecoveryEmail(sessionToken: string, email: string): Promise<MeProfile> {
  const res = await apiFetch(`${apiBase()}/api/me/email`, {
    method: 'PUT',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) await failFromResponse(res, 'Could not save email');
  return normalizeMe((await res.json()) as MeProfile);
}

export async function resendVerificationEmail(sessionToken: string): Promise<MeProfile> {
  const res = await apiFetch(`${apiBase()}/api/me/email/resend`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) await failFromResponse(res, 'Could not resend email');
  return normalizeMe((await res.json()) as MeProfile);
}

export async function linkGoogle(sessionToken: string, idToken: string): Promise<MeProfile> {
  const res = await apiFetch(`${apiBase()}/api/me/google`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify({ idToken }),
  });
  // A rejected Google token is also a 401; don't treat it as an expired Pokr session.
  if (!res.ok) throw new Error(await parseError(res, 'Could not connect Google'));
  return normalizeMe((await res.json()) as MeProfile);
}

export async function unlinkGoogle(sessionToken: string): Promise<MeProfile> {
  const res = await apiFetch(`${apiBase()}/api/me/google`, {
    method: 'DELETE',
    headers: sessionHeaders(sessionToken),
  });
  if (!res.ok) await failFromResponse(res, 'Could not disconnect Google');
  return normalizeMe((await res.json()) as MeProfile);
}

export async function signup(
  username: string,
  password: string,
  avatarId?: number,
  email?: string,
): Promise<AuthSession> {
  const res = await apiFetch(`${apiBase()}/api/signup`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ username, password, avatarId, email: email?.trim() || undefined }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Signup failed'));
  return res.json() as Promise<AuthSession>;
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const res = await apiFetch(`${apiBase()}/api/login`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Login failed'));
  return res.json() as Promise<AuthSession>;
}

export async function logout(sessionToken: string): Promise<void> {
  await apiFetch(`${apiBase()}/api/logout`, {
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
  const res = await apiFetch(`${apiBase()}/api/ticket`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify({}),
  });
  if (!res.ok) await failFromResponse(res, 'Session expired');
  return res.json();
}

export async function fetchMe(
  sessionToken: string,
  options?: { silent?: boolean },
): Promise<MeProfile> {
  const res = await apiFetch(`${apiBase()}/api/me`, {
    method: 'GET',
    headers: sessionHeaders(sessionToken),
    silent: options?.silent,
  });
  if (!res.ok) await failFromResponse(res, 'Could not load profile');
  return normalizeMe((await res.json()) as MeProfile);
}

export async function updateMe(
  sessionToken: string,
  body: {
    avatarId?: number;
    avatarUrl?: string | null;
    tableColorId?: number;
    cardThemeId?: string;
    uiTheme?: UiTheme;
    tableLayout?: TableLayout;
    sfxMuted?: boolean;
    keyboardShortcuts?: KeyboardShortcuts;
  },
): Promise<MeProfile> {
  const res = await apiFetch(`${apiBase()}/api/me`, {
    method: 'PATCH',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) await failFromResponse(res, 'Could not update profile');
  return normalizeMe((await res.json()) as MeProfile);
}

export async function requestAvatarUploadUrl(
  sessionToken: string,
  body: { contentType: 'image/jpeg' | 'image/png' | 'image/webp'; contentLength: number },
): Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }> {
  const res = await apiFetch(`${apiBase()}/api/me/avatar/upload-url`, {
    method: 'POST',
    headers: sessionHeaders(sessionToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) await failFromResponse(res, 'Could not start avatar upload');
  return res.json() as Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }>;
}
