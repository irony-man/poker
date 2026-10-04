import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InstagramIdentity } from './auth.types.js';

export class InstagramAuthNotConfiguredError extends Error {
  constructor() {
    super('Instagram sign-in is not configured');
    this.name = 'InstagramAuthNotConfiguredError';
  }
}

export class InvalidInstagramAuthError extends Error {
  constructor(message = 'Instagram sign-in failed. Please try again.') {
    super(message);
    this.name = 'InvalidInstagramAuthError';
  }
}

type OauthIntent = 'login' | 'link';

export type InstagramOauthState = {
  v: 1;
  t: number;
  n: string;
  intent: OauthIntent;
  next: string;
  userId?: string;
};

export type InstagramPendingPayload = {
  v: 1;
  t: number;
  id: string;
  username: string;
  name: string | null;
  next: string;
};

const STATE_TTL_MS = 15 * 60_000;
const PENDING_TTL_MS = 15 * 60_000;

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function normalizeInstagramRedirectUri(raw: string): string {
  try {
    const uri = new URL(raw);
    if (uri.hostname === 'localhost' || uri.hostname === '127.0.0.1') {
      uri.protocol = 'https:';
    }
    if (uri.pathname.length > 1) {
      uri.pathname = uri.pathname.replace(/\/+$/, '');
    }
    return uri.toString();
  } catch {
    return raw.replace(/\/+$/, '');
  }
}
function parseUserId(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(Math.trunc(raw));
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

/**
 * Instagram API with Instagram Login (authorization-code). Professional accounts
 * only — Meta retired Basic Display for personal accounts.
 */
@Injectable()
export class InstagramOAuth {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;

  constructor(config: ConfigService) {
    this.appId = (config.get<string>('INSTAGRAM_APP_ID') ?? '').trim();
    this.appSecret = (config.get<string>('INSTAGRAM_APP_SECRET') ?? '').trim();
    const explicit = (config.get<string>('INSTAGRAM_REDIRECT_URI') ?? '').trim();
    const firstOrigin = (config.get<string>('WEB_ORIGIN') ?? '').split(',')[0]?.trim();
    const webUrl = (
      config.get<string>('PUBLIC_WEB_URL')?.trim() ||
      firstOrigin ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    this.redirectUri = normalizeInstagramRedirectUri(
      explicit || `${webUrl}/auth/instagram/callback`,
    );
  }

  isConfigured(): boolean {
    return Boolean(this.appId && this.appSecret);
  }

  configuredRedirectUri(): string | null {
    return this.isConfigured() ? this.redirectUri : null;
  }

  private requireSecret(): string {
    if (!this.isConfigured()) throw new InstagramAuthNotConfiguredError();
    return this.appSecret;
  }

  private sign(payloadB64: string): string {
    return createHmac('sha256', this.requireSecret()).update(payloadB64).digest('base64url');
  }

  private encodeSigned(payload: unknown): string {
    const body = b64urlJson(payload);
    return `${body}.${this.sign(body)}`;
  }

  private decodeSigned<T>(token: string, ttlMs: number): T {
    const secret = this.requireSecret();
    const dot = token.lastIndexOf('.');
    if (dot <= 0) throw new InvalidInstagramAuthError();
    const body = token.slice(0, dot);
    const mac = token.slice(dot + 1);
    const expected = createHmac('sha256', secret).update(body).digest('base64url');
    if (!safeEqual(mac, expected)) throw new InvalidInstagramAuthError();
    let parsed: T & { t?: unknown };
    try {
      parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { t?: unknown };
    } catch {
      throw new InvalidInstagramAuthError();
    }
    if (typeof parsed.t !== 'number' || Date.now() - parsed.t > ttlMs) {
      throw new InvalidInstagramAuthError('Instagram sign-in expired. Please try again.');
    }
    return parsed;
  }

  createState(input: { intent: OauthIntent; next: string; userId?: string }): string {
    const payload: InstagramOauthState = {
      v: 1,
      t: Date.now(),
      n: randomBytes(12).toString('base64url'),
      intent: input.intent,
      next: input.next,
      ...(input.userId ? { userId: input.userId } : {}),
    };
    return this.encodeSigned(payload);
  }

  parseState(state: string): InstagramOauthState {
    const parsed = this.decodeSigned<InstagramOauthState>(state, STATE_TTL_MS);
    if (parsed.v !== 1 || (parsed.intent !== 'login' && parsed.intent !== 'link')) {
      throw new InvalidInstagramAuthError();
    }
    if (typeof parsed.next !== 'string') throw new InvalidInstagramAuthError();
    return parsed;
  }

  createPending(identity: InstagramIdentity, next = '/'): string {
    const payload: InstagramPendingPayload = {
      v: 1,
      t: Date.now(),
      id: identity.id,
      username: identity.username,
      name: identity.name,
      next,
    };
    return this.encodeSigned(payload);
  }

  parsePending(token: string): InstagramIdentity & { next: string } {
    const parsed = this.decodeSigned<InstagramPendingPayload>(token, PENDING_TTL_MS);
    if (parsed.v !== 1 || !parsed.id) throw new InvalidInstagramAuthError();
    return {
      id: parsed.id,
      username: typeof parsed.username === 'string' ? parsed.username : '',
      name: typeof parsed.name === 'string' ? parsed.name : null,
      next: typeof parsed.next === 'string' ? parsed.next : '/',
    };
  }

  authorizeUrl(state: string): string {
    if (!this.isConfigured()) throw new InstagramAuthNotConfiguredError();
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'instagram_business_basic',
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<InstagramIdentity> {
    if (!this.isConfigured()) throw new InstagramAuthNotConfiguredError();
    const trimmed = code.trim();
    if (!trimmed) throw new InvalidInstagramAuthError();

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code: trimmed,
    });
    let tokenRes: Response;
    try {
      tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new InvalidInstagramAuthError();
    }
    const tokenJson = (await tokenRes.json().catch(() => null)) as Record<string, unknown> | null;
    if (!tokenRes.ok || !tokenJson) throw new InvalidInstagramAuthError();

    const data = Array.isArray(tokenJson.data) ? tokenJson.data[0] : tokenJson;
    const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const accessToken = typeof row.access_token === 'string' ? row.access_token : null;
    const tokenUserId = parseUserId(row.user_id) ?? parseUserId(row.id);
    if (!accessToken) throw new InvalidInstagramAuthError();

    const meUrl = new URL('https://graph.instagram.com/me');
    meUrl.searchParams.set('fields', 'id,user_id,username,name');
    meUrl.searchParams.set('access_token', accessToken);
    let meRes: Response;
    try {
      meRes = await fetch(meUrl);
    } catch {
      throw new InvalidInstagramAuthError();
    }
    const me = (await meRes.json().catch(() => null)) as Record<string, unknown> | null;
    if (!meRes.ok || !me) throw new InvalidInstagramAuthError();

    const id = parseUserId(me.user_id) ?? parseUserId(me.id) ?? tokenUserId;
    if (!id) throw new InvalidInstagramAuthError();
    const username = typeof me.username === 'string' ? me.username : '';
    const name = typeof me.name === 'string' && me.name.trim() ? me.name.trim() : null;
    return { id, username, name };
  }
}
