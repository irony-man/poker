import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export const SESSION_COOKIE = 'lt_session';
const SESSION_MAX_AGE_SEC = 12 * 60 * 60;

function digest(s: string): Buffer {
  return createHash('sha256').update(s).digest();
}

/** Constant-time string comparison (hashes first so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Stateless session value: HMAC over the expiry, keyed by the admin token. Rotating
 * `LOADTEST_ADMIN_TOKEN` invalidates every session.
 */
export function issueSession(adminToken: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + SESSION_MAX_AGE_SEC;
  const mac = createHmac('sha256', adminToken).update(`lt-session:${exp}`).digest('base64url');
  return `${exp}.${mac}`;
}

export function verifySession(adminToken: string, value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const [expRaw, mac] = value.split('.');
  const exp = Number(expRaw);
  if (!mac || !Number.isInteger(exp) || exp * 1000 < now) return false;
  const want = createHmac('sha256', adminToken).update(`lt-session:${exp}`).digest('base64url');
  return safeEqual(mac, want);
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function isAuthed(req: IncomingMessage, adminToken: string): boolean {
  return verifySession(adminToken, parseCookies(req.headers.cookie)[SESSION_COOKIE]);
}

export function sessionCookie(value: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SEC}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

/** Failed-login limiter: `max` failures per IP per window. */
export class LoginLimiter {
  private readonly fails = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max = 10,
    private readonly windowMs = 10 * 60_000,
  ) {}

  blocked(ip: string, now = Date.now()): boolean {
    const f = this.fails.get(ip);
    if (!f) return false;
    if (f.resetAt < now) {
      this.fails.delete(ip);
      return false;
    }
    return f.count >= this.max;
  }

  fail(ip: string, now = Date.now()): void {
    const f = this.fails.get(ip);
    if (!f || f.resetAt < now) this.fails.set(ip, { count: 1, resetAt: now + this.windowMs });
    else f.count += 1;
  }

  reset(ip: string): void {
    this.fails.delete(ip);
  }
}
