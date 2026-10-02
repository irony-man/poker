import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import type { Queryable } from '../database/queryable.js';
import { avatarIdFromUserId, clampAvatarId } from '../avatars.js';
import { clampTableColorId } from '../table-colors.js';
import { clampUserKeyboardShortcuts } from '../keyboard-shortcuts.js';
import { clampSfxMuted } from '../sfx-muted.js';
import { clampTableLayout } from '../table-layout.js';
import { clampUiTheme } from '../ui-theme.js';
import { DEFAULT_CARD_THEME_ID } from '../card-face-theme.js';
import {
  defaultEconomy,
  type EconomyProvider,
  STARTING_CHIP_GRANT,
  STARTING_WHUFFIE_GRANT,
} from '../wallet/wallet.constants.js';
import {
  AuthError,
  type AuthSessionPayload,
  type EmailToken,
  type EmailTokenPurpose,
  type GoogleIdentity,
  type GoogleSignInResult,
  type PublicUser,
  type Session,
  type User,
  type WsTicket,
} from './auth.types.js';

interface PersistedSnapshot {
  users: User[];
  sessions: Session[];
  tickets: WsTicket[];
  emailTokens?: EmailToken[];
}

export const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000;

const USERNAME_MAX = 24;

function hashEmailToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim();
}

function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

/** Turn a Google display name / email local part into something `UsernameSchema` accepts. */
export function usernameBaseFromGoogle(identity: Pick<GoogleIdentity, 'name' | 'email'>): string {
  const source = identity.name?.trim() || identity.email?.split('@')[0] || '';
  let base = source
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (base.toLowerCase().startsWith('bot')) base = `p_${base}`;
  if (base.length < 3) base = `player${base}`;
  return base.slice(0, USERNAME_MAX - 4);
}

function toPublic(u: User): PublicUser {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatarId: u.avatarId,
    avatarUrl: u.avatarUrl ?? null,
    tableColorId: u.tableColorId,
    createdAt: u.createdAt,
    chipBalance: u.chipBalance,
    whuffieBalance: u.whuffieBalance,
  };
}

function normalizeUser(
  u: User,
  fallbackChips = STARTING_CHIP_GRANT,
  fallbackWhuffies = STARTING_WHUFFIE_GRANT,
): User {
  return {
    ...u,
    passwordHash: typeof u.passwordHash === 'string' && u.passwordHash ? u.passwordHash : null,
    email: typeof u.email === 'string' && u.email.trim() ? normalizeEmail(u.email) : null,
    emailVerified: u.emailVerified === true && typeof u.email === 'string' && !!u.email.trim(),
    googleSub: typeof u.googleSub === 'string' && u.googleSub ? u.googleSub : null,
    avatarId: clampAvatarId(u.avatarId),
    avatarUrl: u.avatarUrl ?? null,
    tableColorId: clampTableColorId(u.tableColorId),
    cardThemeId:
      typeof u.cardThemeId === 'string' && u.cardThemeId.trim()
        ? u.cardThemeId.trim().slice(0, 64)
        : DEFAULT_CARD_THEME_ID,
    uiTheme: clampUiTheme(u.uiTheme),
    tableLayout: clampTableLayout(u.tableLayout),
    sfxMuted: clampSfxMuted(u.sfxMuted),
    keyboardShortcuts: clampUserKeyboardShortcuts(u.keyboardShortcuts),
    chipBalance: normalizeNonNegInt(u.chipBalance, fallbackChips),
    whuffieBalance: normalizeNonNegInt(u.whuffieBalance, fallbackWhuffies),
    handsPlayed: normalizeNonNegInt(u.handsPlayed, 0),
  };
}

function normalizeNonNegInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return Math.max(0, Math.floor(fallback));
}

/** File-backed (or Postgres-backed via Queryable) user + session + ticket store. */
export class AuthStore {
  private users = new Map<string, User>();
  private usernameIndex = new Map<string, string>(); // lower -> id
  private emailIndex = new Map<string, string>(); // verified email lower -> id
  private googleSubIndex = new Map<string, string>(); // google sub -> id
  private tickets = new Map<string, WsTicket>();
  private sessions = new Map<string, Session>();
  /** File-backed mode only; Postgres mode reads/consumes `auth_email_tokens` directly. */
  private emailTokens = new Map<string, EmailToken>(); // token hash -> token
  private loaded = false;
  private readonly filePath: string;
  private pool: Queryable | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  private lastExpiredCleanupAt = 0;
  private static readonly EXPIRED_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  private economyProvider: EconomyProvider = defaultEconomy;

  constructor(dataDir = path.join(process.cwd(), 'data')) {
    this.filePath = path.join(dataDir, 'users.json');
  }

  setPool(pool: Queryable | null): void {
    this.pool = pool;
  }

  setEconomyProvider(provider: EconomyProvider): void {
    this.economyProvider = provider;
  }

  private startingGrant(): number {
    return this.economyProvider().startingChipGrant;
  }

  private startingWhuffies(): number {
    return this.economyProvider().startingWhuffieGrant;
  }

  async init(): Promise<void> {
    await this.ensureLoaded();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    if (this.pool) {
      await this.loadFromPostgres();
    } else {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await this.loadFromFile();
    }
    this.loaded = true;
  }

  private async loadFromFile(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const snap = JSON.parse(raw) as PersistedSnapshot;
      this.clearMemory();
      for (const u of snap.users ?? []) {
        this.indexUser(
          normalizeUser({
            ...u,
            tableColorId: (u as User).tableColorId ?? 0,
            cardThemeId: (u as User).cardThemeId ?? DEFAULT_CARD_THEME_ID,
            uiTheme: clampUiTheme((u as User).uiTheme),
            tableLayout: clampTableLayout((u as User).tableLayout),
            sfxMuted: clampSfxMuted((u as User).sfxMuted),
            keyboardShortcuts: clampUserKeyboardShortcuts((u as User).keyboardShortcuts),
            chipBalance: normalizeNonNegInt((u as User).chipBalance, STARTING_CHIP_GRANT),
            whuffieBalance: normalizeNonNegInt(
              (u as User).whuffieBalance,
              STARTING_WHUFFIE_GRANT,
            ),
            handsPlayed: normalizeNonNegInt((u as User).handsPlayed, 0),
          }),
        );
      }
      for (const s of snap.sessions ?? []) {
        if (s.expiresAt > Date.now()) this.sessions.set(s.token, s);
      }
      for (const t of snap.tickets ?? []) {
        if (t.expiresAt > Date.now()) this.tickets.set(t.ticket, t);
      }
      for (const t of snap.emailTokens ?? []) {
        if (t.expiresAt > Date.now() && t.usedAt === null) this.emailTokens.set(t.tokenHash, t);
      }
    } catch {
      this.clearMemory();
    }
  }

  private clearMemory(): void {
    this.users.clear();
    this.usernameIndex.clear();
    this.emailIndex.clear();
    this.googleSubIndex.clear();
    this.sessions.clear();
    this.tickets.clear();
    this.emailTokens.clear();
  }

  private async loadFromPostgres(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS hands_played integer NOT NULL DEFAULT 0`,
    );
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_theme text NOT NULL DEFAULT 'v1'`,
    );
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS table_layout text NOT NULL DEFAULT 'v1'`,
    );
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS sfx_muted boolean NOT NULL DEFAULT false`,
    );
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS keyboard_shortcuts jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS card_theme_id text NOT NULL DEFAULT 'classic'`,
    );
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`);
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_lower text`);
    await this.pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false`,
    );
    await this.pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text`);
    await this.pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_verified_uidx ON users (email_lower)
       WHERE email_lower IS NOT NULL AND email_verified`,
    );
    await this.pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uidx ON users (google_sub)
       WHERE google_sub IS NOT NULL`,
    );
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS auth_email_tokens (
         token_hash text PRIMARY KEY,
         user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         purpose text NOT NULL,
         email text NOT NULL,
         expires_at timestamptz NOT NULL,
         used_at timestamptz
       )`,
    );
    await this.pool.query(
      `CREATE INDEX IF NOT EXISTS auth_email_tokens_user_idx ON auth_email_tokens (user_id)`,
    );
    const result = await this.pool.query(
      `SELECT id, name, username, password_hash, email, email_verified, google_sub, avatar_id, avatar_url, table_color_id, card_theme_id, ui_theme, table_layout, sfx_muted, keyboard_shortcuts, chip_balance, whuffie_balance, hands_played, created_at
       FROM users
       WHERE username IS NOT NULL AND (password_hash IS NOT NULL OR google_sub IS NOT NULL)`,
    );
    this.clearMemory();

    for (const row of result.rows as {
      id: string;
      name: string;
      username: string;
      password_hash: string | null;
      email?: string | null;
      email_verified?: boolean | null;
      google_sub?: string | null;
      avatar_id: number;
      avatar_url?: string | null;
      table_color_id?: number | null;
      card_theme_id?: string | null;
      ui_theme?: string | null;
      table_layout?: string | null;
      sfx_muted?: boolean | null;
      keyboard_shortcuts?: Record<string, string> | null;
      chip_balance?: number | null;
      whuffie_balance?: number | null;
      hands_played?: number | null;
      created_at: Date | string;
    }[]) {
      const createdAt =
        row.created_at instanceof Date
          ? row.created_at.getTime()
          : new Date(row.created_at).getTime();
      const user: User = {
        id: row.id,
        username: row.username,
        name: row.username || row.name,
        passwordHash: row.password_hash || null,
        email: row.email?.trim() ? normalizeEmail(row.email) : null,
        emailVerified: row.email_verified === true && !!row.email?.trim(),
        googleSub: row.google_sub || null,
        avatarId: clampAvatarId(row.avatar_id ?? 0),
        avatarUrl: row.avatar_url ?? null,
        tableColorId: clampTableColorId(row.table_color_id ?? 0),
        cardThemeId:
          typeof row.card_theme_id === 'string' && row.card_theme_id.trim()
            ? row.card_theme_id.trim().slice(0, 64)
            : DEFAULT_CARD_THEME_ID,
        uiTheme: clampUiTheme(row.ui_theme),
        tableLayout: clampTableLayout(row.table_layout),
        sfxMuted: clampSfxMuted(row.sfx_muted),
        keyboardShortcuts: clampUserKeyboardShortcuts(row.keyboard_shortcuts),
        chipBalance: normalizeNonNegInt(row.chip_balance, STARTING_CHIP_GRANT),
        whuffieBalance: normalizeNonNegInt(row.whuffie_balance, STARTING_WHUFFIE_GRANT),
        handsPlayed: normalizeNonNegInt(row.hands_played, 0),
        createdAt,
      };
      this.indexUser(user);
    }

    const sessions = await this.pool.query(
      `SELECT token, user_id, expires_at FROM auth_sessions WHERE expires_at > NOW()`,
    );
    for (const row of sessions.rows as {
      token: string;
      user_id: string;
      expires_at: Date | string;
    }[]) {
      const expiresAt =
        row.expires_at instanceof Date
          ? row.expires_at.getTime()
          : new Date(row.expires_at).getTime();
      this.sessions.set(row.token, {
        token: row.token,
        userId: row.user_id,
        expiresAt,
      });
    }

    const tickets = await this.pool.query(
      `SELECT ticket, user_id, expires_at FROM auth_tickets WHERE expires_at > NOW()`,
    );
    for (const row of tickets.rows as {
      ticket: string;
      user_id: string;
      expires_at: Date | string;
    }[]) {
      const expiresAt =
        row.expires_at instanceof Date
          ? row.expires_at.getTime()
          : new Date(row.expires_at).getTime();
      this.tickets.set(row.ticket, {
        ticket: row.ticket,
        userId: row.user_id,
        expiresAt,
      });
    }
  }

  private indexUser(user: User): void {
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username.toLowerCase(), user.id);
    if (user.email && user.emailVerified) this.emailIndex.set(emailKey(user.email), user.id);
    if (user.googleSub) this.googleSubIndex.set(user.googleSub, user.id);
  }

  private unindexEmail(user: User): void {
    if (!user.email) return;
    const key = emailKey(user.email);
    if (this.emailIndex.get(key) === user.id) this.emailIndex.delete(key);
  }

  private async persistFile(): Promise<void> {
    if (this.pool) return;
    const run = async () => {
      const snap: PersistedSnapshot = {
        users: [...this.users.values()],
        sessions: [...this.sessions.values()],
        tickets: [...this.tickets.values()],
        emailTokens: [...this.emailTokens.values()],
      };
      await this.writeAtomic(snap);
    };
    this.writeChain = this.writeChain.then(run, run);
    await this.writeChain;
  }

  private async maybeCleanupExpiredPostgres(): Promise<void> {
    if (!this.pool) return;
    const now = Date.now();
    if (now - this.lastExpiredCleanupAt < AuthStore.EXPIRED_CLEANUP_INTERVAL_MS) return;
    this.lastExpiredCleanupAt = now;
    for (const [token, s] of this.sessions) {
      if (s.expiresAt <= now) this.sessions.delete(token);
    }
    for (const [ticket, t] of this.tickets) {
      if (t.expiresAt <= now) this.tickets.delete(ticket);
    }
    await Promise.all([
      this.pool.query(`DELETE FROM auth_sessions WHERE expires_at <= NOW()`),
      this.pool.query(`DELETE FROM auth_tickets WHERE expires_at <= NOW()`),
      this.pool.query(
        `DELETE FROM auth_email_tokens WHERE expires_at <= NOW() OR used_at IS NOT NULL`,
      ),
    ]);
  }

  private async upsertSessionPostgres(session: Session): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO auth_sessions (token, user_id, expires_at)
       VALUES ($1, $2, to_timestamp($3 / 1000.0))
       ON CONFLICT (token) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         expires_at = EXCLUDED.expires_at`,
      [session.token, session.userId, session.expiresAt],
    );
  }

  private async upsertTicketPostgres(ticket: WsTicket): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO auth_tickets (ticket, user_id, expires_at)
       VALUES ($1, $2, to_timestamp($3 / 1000.0))
       ON CONFLICT (ticket) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         expires_at = EXCLUDED.expires_at`,
      [ticket.ticket, ticket.userId, ticket.expiresAt],
    );
  }

  private async deleteSessionPostgres(token: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`DELETE FROM auth_sessions WHERE token = $1`, [token]);
  }

  private async writeAtomic(snap: PersistedSnapshot): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tmp, JSON.stringify(snap, null, 2), 'utf8');
    await rename(tmp, this.filePath);
  }

  private async persistUserToPostgres(user: User): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      `INSERT INTO users (id, name, username, username_lower, password_hash, avatar_id, avatar_url, table_color_id, card_theme_id, ui_theme, table_layout, sfx_muted, keyboard_shortcuts, chip_balance, whuffie_balance, hands_played, created_at, email, email_lower, email_verified, google_sub)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, to_timestamp($17 / 1000.0), $18, $19, $20, $21)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         username = EXCLUDED.username,
         username_lower = EXCLUDED.username_lower,
         password_hash = EXCLUDED.password_hash,
         email = EXCLUDED.email,
         email_lower = EXCLUDED.email_lower,
         email_verified = EXCLUDED.email_verified,
         google_sub = EXCLUDED.google_sub,
         avatar_id = EXCLUDED.avatar_id,
         avatar_url = EXCLUDED.avatar_url,
         table_color_id = EXCLUDED.table_color_id,
         card_theme_id = EXCLUDED.card_theme_id,
         ui_theme = EXCLUDED.ui_theme,
         table_layout = EXCLUDED.table_layout,
         sfx_muted = EXCLUDED.sfx_muted,
         keyboard_shortcuts = EXCLUDED.keyboard_shortcuts,
         chip_balance = EXCLUDED.chip_balance,
         whuffie_balance = EXCLUDED.whuffie_balance,
         hands_played = EXCLUDED.hands_played`,
      [
        user.id,
        user.name,
        user.username,
        user.username.toLowerCase(),
        user.passwordHash,
        user.avatarId,
        user.avatarUrl,
        user.tableColorId,
        user.cardThemeId,
        user.uiTheme,
        user.tableLayout,
        user.sfxMuted,
        JSON.stringify(user.keyboardShortcuts ?? {}),
        user.chipBalance,
        user.whuffieBalance,
        user.handsPlayed,
        user.createdAt,
        user.email,
        user.email ? emailKey(user.email) : null,
        user.emailVerified,
        user.googleSub,
      ],
    );
  }

  private async persistIdentity(user: User): Promise<void> {
    if (this.pool) {
      await this.pool.query(
        `UPDATE users SET password_hash = $1, email = $2, email_lower = $3, email_verified = $4, google_sub = $5
         WHERE id = $6`,
        [
          user.passwordHash,
          user.email,
          user.email ? emailKey(user.email) : null,
          user.emailVerified,
          user.googleSub,
          user.id,
        ],
      );
    } else {
      await this.persistFile();
    }
  }

  private newUser(
    id: string,
    username: string,
    passwordHash: string | null,
    avatarId: number,
  ): User {
    return {
      id,
      username,
      name: username,
      passwordHash,
      email: null,
      emailVerified: false,
      googleSub: null,
      avatarId,
      avatarUrl: null,
      tableColorId: 0,
      cardThemeId: DEFAULT_CARD_THEME_ID,
      uiTheme: 'v1',
      tableLayout: 'v1',
      sfxMuted: false,
      keyboardShortcuts: clampUserKeyboardShortcuts({}),
      chipBalance: this.startingGrant(),
      whuffieBalance: this.startingWhuffies(),
      handsPlayed: 0,
      createdAt: Date.now(),
    };
  }

  async signup(
    username: string,
    password: string,
    avatarId?: number,
  ): Promise<AuthSessionPayload> {
    await this.ensureLoaded();
    const trimmed = username.trim();
    const key = trimmed.toLowerCase();
    if (this.usernameIndex.has(key)) {
      throw new AuthError('username_taken', 'Username already taken');
    }

    const id = nanoid(12);
    const user = this.newUser(
      id,
      trimmed,
      await argon2.hash(password),
      avatarId !== undefined ? clampAvatarId(avatarId) : avatarIdFromUserId(id),
    );
    this.indexUser(user);
    await this.persistUserToPostgres(user);
    if (!this.pool) await this.persistFile();
    return this.issueAuthSession(user);
  }

  async login(username: string, password: string): Promise<AuthSessionPayload> {
    await this.ensureLoaded();
    const key = username.trim().toLowerCase();
    const id = this.usernameIndex.get(key);
    if (!id) {
      throw new AuthError('invalid_credentials', 'Invalid username or password');
    }
    const user = this.users.get(id)!;
    let ok = false;
    if (user.passwordHash) {
      try {
        ok = await argon2.verify(user.passwordHash, password);
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      throw new AuthError('invalid_credentials', 'Invalid username or password');
    }
    return this.issueAuthSession(user);
  }

  private async issueAuthSession(user: User): Promise<AuthSessionPayload> {
    const sessionToken = this.createSession(user.id);
    const ticket = this.issueTicket(user.id, undefined, false);
    const session = this.sessions.get(sessionToken)!;
    const wsTicket = this.tickets.get(ticket)!;
    if (this.pool) {
      await Promise.all([
        this.upsertSessionPostgres(session),
        this.upsertTicketPostgres(wsTicket),
      ]);
      void this.maybeCleanupExpiredPostgres();
    } else {
      await this.persistFile();
    }
    return {
      userId: user.id,
      username: user.username,
      name: user.name,
      ticket,
      sessionToken,
      avatarId: user.avatarId,
      avatarUrl: user.avatarUrl,
      chipBalance: user.chipBalance,
      whuffieBalance: user.whuffieBalance,
    };
  }

  getUserByGoogleSub(sub: string): User | undefined {
    const id = this.googleSubIndex.get(sub);
    return id ? this.users.get(id) : undefined;
  }

  getUserByVerifiedEmail(email: string): User | undefined {
    const id = this.emailIndex.get(emailKey(email));
    return id ? this.users.get(id) : undefined;
  }

  suggestUsername(identity: Pick<GoogleIdentity, 'name' | 'email'>): string {
    const base = usernameBaseFromGoogle(identity);
    if (!this.usernameIndex.has(base.toLowerCase())) return base;
    for (let i = 0; i < 50; i++) {
      const candidate = `${base}${Math.floor(10 + Math.random() * 9990)}`.slice(0, USERNAME_MAX);
      if (!this.usernameIndex.has(candidate.toLowerCase())) return candidate;
    }
    return `${base.slice(0, USERNAME_MAX - 8)}${nanoid(8).replace(/[^a-zA-Z0-9]/g, '0')}`;
  }

  /**
   * Sign in with a verified Google identity. Existing links win, then a user whose
   * *verified* recovery email matches Google's verified email is linked. Otherwise a new
   * password-less account is created once the caller supplies a username.
   */
  async googleSignIn(
    identity: GoogleIdentity,
    opts: { username?: string; avatarId?: number } = {},
  ): Promise<GoogleSignInResult> {
    await this.ensureLoaded();
    const linked = this.getUserByGoogleSub(identity.sub);
    if (linked) {
      return { kind: 'session', session: await this.issueAuthSession(linked), created: false };
    }

    if (identity.email && identity.emailVerified) {
      const byEmail = this.getUserByVerifiedEmail(identity.email);
      if (byEmail && !byEmail.googleSub) {
        byEmail.googleSub = identity.sub;
        this.googleSubIndex.set(identity.sub, byEmail.id);
        await this.persistIdentity(byEmail);
        return { kind: 'session', session: await this.issueAuthSession(byEmail), created: false };
      }
    }

    const username = opts.username?.trim();
    if (!username) {
      return { kind: 'needs_username', suggestedUsername: this.suggestUsername(identity) };
    }
    if (this.usernameIndex.has(username.toLowerCase())) {
      throw new AuthError('username_taken', 'Username already taken');
    }

    const id = nanoid(12);
    const user = this.newUser(
      id,
      username,
      null,
      opts.avatarId !== undefined ? clampAvatarId(opts.avatarId) : avatarIdFromUserId(id),
    );
    user.googleSub = identity.sub;
    if (identity.email && !this.emailIndex.has(emailKey(identity.email))) {
      user.email = normalizeEmail(identity.email);
      user.emailVerified = identity.emailVerified;
    }
    this.indexUser(user);
    await this.persistUserToPostgres(user);
    if (!this.pool) await this.persistFile();
    return { kind: 'session', session: await this.issueAuthSession(user), created: true };
  }

  async linkGoogle(userId: string, identity: GoogleIdentity): Promise<User> {
    await this.ensureLoaded();
    const user = this.requireUser(userId);
    const owner = this.googleSubIndex.get(identity.sub);
    if (owner && owner !== userId) {
      throw new AuthError('google_taken', 'That Google account is linked to another user');
    }
    if (user.googleSub && user.googleSub !== identity.sub) {
      this.googleSubIndex.delete(user.googleSub);
    }
    user.googleSub = identity.sub;
    this.googleSubIndex.set(identity.sub, userId);
    if (
      !user.email &&
      identity.email &&
      identity.emailVerified &&
      !this.emailIndex.has(emailKey(identity.email))
    ) {
      user.email = normalizeEmail(identity.email);
      user.emailVerified = true;
      this.emailIndex.set(emailKey(user.email), userId);
    }
    await this.persistIdentity(user);
    return user;
  }

  async unlinkGoogle(userId: string): Promise<User> {
    await this.ensureLoaded();
    const user = this.requireUser(userId);
    if (!user.passwordHash) {
      throw new AuthError(
        'password_required',
        'Set a password (via Forgot password) before disconnecting Google',
      );
    }
    if (user.googleSub) this.googleSubIndex.delete(user.googleSub);
    user.googleSub = null;
    await this.persistIdentity(user);
    return user;
  }

  /** Store a new (unverified) recovery email. Unchanged verified emails stay verified. */
  async setEmail(userId: string, email: string): Promise<User> {
    await this.ensureLoaded();
    const user = this.requireUser(userId);
    const next = normalizeEmail(email);
    const key = emailKey(next);
    if (user.email && emailKey(user.email) === key && user.emailVerified) return user;
    const owner = this.emailIndex.get(key);
    if (owner && owner !== userId) {
      throw new AuthError('email_taken', 'That email is already used by another account');
    }
    this.unindexEmail(user);
    user.email = next;
    user.emailVerified = false;
    await this.persistIdentity(user);
    return user;
  }

  /** Create a single-use token; only its sha256 is stored. Returns the raw token for the email link. */
  async createEmailToken(
    userId: string,
    purpose: EmailTokenPurpose,
    email: string,
    ttlMs = purpose === 'reset_password' ? RESET_PASSWORD_TTL_MS : VERIFY_EMAIL_TTL_MS,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const record: EmailToken = {
      tokenHash: hashEmailToken(token),
      userId,
      purpose,
      email,
      expiresAt: Date.now() + ttlMs,
      usedAt: null,
    };
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO auth_email_tokens (token_hash, user_id, purpose, email, expires_at)
         VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))`,
        [record.tokenHash, userId, purpose, email, record.expiresAt],
      );
      void this.maybeCleanupExpiredPostgres();
    } else {
      this.emailTokens.set(record.tokenHash, record);
      await this.persistFile();
    }
    return token;
  }

  private async consumeEmailToken(
    token: string,
    purpose: EmailTokenPurpose,
  ): Promise<{ userId: string; email: string }> {
    const invalid = new AuthError('invalid_token', 'This link is invalid or has expired');
    if (!token) throw invalid;
    const tokenHash = hashEmailToken(token);
    if (this.pool) {
      const res = await this.pool.query(
        `UPDATE auth_email_tokens SET used_at = NOW()
         WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id, email`,
        [tokenHash, purpose],
      );
      const row = res.rows[0] as { user_id: string; email: string } | undefined;
      if (!row) throw invalid;
      return { userId: row.user_id, email: row.email };
    }
    const record = this.emailTokens.get(tokenHash);
    if (
      !record ||
      record.purpose !== purpose ||
      record.usedAt !== null ||
      record.expiresAt <= Date.now()
    ) {
      throw invalid;
    }
    this.emailTokens.delete(tokenHash);
    await this.persistFile();
    return { userId: record.userId, email: record.email };
  }

  /** Read-only lookup of an unused, unexpired token (does not consume it). */
  private async peekEmailToken(
    token: string,
    purpose: EmailTokenPurpose,
  ): Promise<{ userId: string; email: string } | null> {
    if (!token) return null;
    const tokenHash = hashEmailToken(token);
    if (this.pool) {
      const res = await this.pool.query(
        `SELECT user_id, email FROM auth_email_tokens
         WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()`,
        [tokenHash, purpose],
      );
      const row = res.rows[0] as { user_id: string; email: string } | undefined;
      return row ? { userId: row.user_id, email: row.email } : null;
    }
    const record = this.emailTokens.get(tokenHash);
    if (
      !record ||
      record.purpose !== purpose ||
      record.usedAt !== null ||
      record.expiresAt <= Date.now()
    ) {
      return null;
    }
    return { userId: record.userId, email: record.email };
  }

  /** True when `resetPassword` would accept this token right now. */
  async isResetTokenValid(token: string): Promise<boolean> {
    await this.ensureLoaded();
    const found = await this.peekEmailToken(token, 'reset_password');
    if (!found) return false;
    const user = this.users.get(found.userId);
    return Boolean(
      user?.email && user.emailVerified && emailKey(user.email) === emailKey(found.email),
    );
  }

  async verifyEmail(token: string): Promise<User> {
    await this.ensureLoaded();
    const { userId, email } = await this.consumeEmailToken(token, 'verify_email');
    const user = this.users.get(userId);
    if (!user || !user.email || emailKey(user.email) !== emailKey(email)) {
      throw new AuthError('invalid_token', 'This link is invalid or has expired');
    }
    const owner = this.emailIndex.get(emailKey(email));
    if (owner && owner !== userId) {
      throw new AuthError('email_taken', 'That email is already used by another account');
    }
    user.emailVerified = true;
    this.emailIndex.set(emailKey(email), userId);
    await this.persistIdentity(user);
    return user;
  }

  /** Account to email a reset link to: by username or verified email, and only if it has a verified email. */
  findRecoverableUser(identifier: string): User | undefined {
    const trimmed = identifier.trim();
    const user = trimmed.includes('@')
      ? this.getUserByVerifiedEmail(trimmed)
      : this.getUserByUsername(trimmed);
    return user?.email && user.emailVerified ? user : undefined;
  }

  async resetPassword(token: string, password: string): Promise<User> {
    await this.ensureLoaded();
    const { userId, email } = await this.consumeEmailToken(token, 'reset_password');
    const user = this.users.get(userId);
    if (!user || !user.email || !user.emailVerified || emailKey(user.email) !== emailKey(email)) {
      throw new AuthError('invalid_token', 'This link is invalid or has expired');
    }
    user.passwordHash = await argon2.hash(password);
    await this.persistIdentity(user);
    await this.revokeAllSessions(userId);
    return user;
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    for (const [token, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(token);
    }
    for (const [ticket, wsTicket] of this.tickets) {
      if (wsTicket.userId === userId) this.tickets.delete(ticket);
    }
    if (this.pool) {
      await this.pool.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
      await this.pool.query(`DELETE FROM auth_tickets WHERE user_id = $1`, [userId]);
    } else {
      await this.persistFile();
    }
  }

  private requireUser(userId: string): User {
    const user = this.users.get(userId);
    if (!user) throw new AuthError('invalid_credentials', 'Unknown user');
    return user;
  }

  createSession(userId: string, ttlMs = 30 * 24 * 60 * 60 * 1000): string {
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, { token, userId, expiresAt: Date.now() + ttlMs });
    return token;
  }

  resolveSession(token: string): User | null {
    if (!token) return null;
    const s = this.sessions.get(token);
    if (!s) return null;
    if (Date.now() > s.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return this.users.get(s.userId) ?? null;
  }

  async revokeSession(token: string): Promise<void> {
    if (!this.sessions.delete(token)) return;
    if (this.pool) {
      await this.deleteSessionPostgres(token);
    } else {
      await this.persistFile();
    }
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  hasUser(userId: string): boolean {
    return this.users.has(userId);
  }

  getChipBalance(userId: string): number | undefined {
    return this.users.get(userId)?.chipBalance;
  }

  async setChipBalance(userId: string, balance: number): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.chipBalance = Math.max(0, Math.floor(balance));
    if (this.pool) {
      await this.pool.query(`UPDATE users SET chip_balance = $1 WHERE id = $2`, [
        user.chipBalance,
        userId,
      ]);
    } else {
      await this.persistFile();
    }
  }

  getWhuffieBalance(userId: string): number | undefined {
    return this.users.get(userId)?.whuffieBalance;
  }

  async setWhuffieBalance(userId: string, balance: number): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.whuffieBalance = Math.max(0, Math.floor(balance));
    if (this.pool) {
      await this.pool.query(`UPDATE users SET whuffie_balance = $1 WHERE id = $2`, [
        user.whuffieBalance,
        userId,
      ]);
    } else {
      await this.persistFile();
    }
  }

  async setAvatarId(userId: string, avatarId: number): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.avatarId = clampAvatarId(avatarId);
    user.avatarUrl = null;
    if (this.pool) {
      await this.pool.query(
        `UPDATE users SET avatar_id = $1, avatar_url = NULL WHERE id = $2`,
        [user.avatarId, userId],
      );
    } else {
      await this.persistFile();
    }
    return user;
  }

  async setAvatarUrl(userId: string, avatarUrl: string | null): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.avatarUrl = avatarUrl;
    if (this.pool) {
      await this.pool.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [
        avatarUrl,
        userId,
      ]);
    } else {
      await this.persistFile();
    }
    return user;
  }

  async setTableColorId(userId: string, tableColorId: number): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.tableColorId = clampTableColorId(tableColorId);
    if (this.pool) {
      await this.pool.query(`UPDATE users SET table_color_id = $1 WHERE id = $2`, [
        user.tableColorId,
        userId,
      ]);
    } else {
      await this.persistFile();
    }
    return user;
  }

  async setCardThemeId(userId: string, cardThemeId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.cardThemeId =
      typeof cardThemeId === 'string' && cardThemeId.trim()
        ? cardThemeId.trim().slice(0, 64)
        : DEFAULT_CARD_THEME_ID;
    if (this.pool) {
      await this.pool.query(`UPDATE users SET card_theme_id = $1 WHERE id = $2`, [
        user.cardThemeId,
        userId,
      ]);
    } else {
      await this.persistFile();
    }
    return user;
  }

  async setUiTheme(userId: string, uiTheme: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.uiTheme = clampUiTheme(uiTheme);
    if (this.pool) {
      await this.pool.query(`UPDATE users SET ui_theme = $1 WHERE id = $2`, [
        user.uiTheme,
        userId,
      ]);
    } else {
      await this.persistFile();
    }
    return user;
  }

  async setTableLayout(userId: string, tableLayout: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.tableLayout = clampTableLayout(tableLayout);
    if (this.pool) {
      await this.pool.query(`UPDATE users SET table_layout = $1 WHERE id = $2`, [
        user.tableLayout,
        userId,
      ]);
    } else {
      await this.persistFile();
    }
    return user;
  }

  async setSfxMuted(userId: string, sfxMuted: boolean): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.sfxMuted = clampSfxMuted(sfxMuted);
    if (this.pool) {
      await this.pool.query(`UPDATE users SET sfx_muted = $1 WHERE id = $2`, [
        user.sfxMuted,
        userId,
      ]);
    } else {
      await this.persistFile();
    }
    return user;
  }

  async setKeyboardShortcuts(
    userId: string,
    shortcuts: Record<string, string>,
  ): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.keyboardShortcuts = clampUserKeyboardShortcuts(shortcuts);
    if (this.pool) {
      await this.pool.query(`UPDATE users SET keyboard_shortcuts = $1::jsonb WHERE id = $2`, [
        JSON.stringify(user.keyboardShortcuts),
        userId,
      ]);
    } else {
      await this.persistFile();
    }
    return user;
  }

  async incrementHandsPlayed(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.handsPlayed = (user.handsPlayed ?? 0) + 1;
    if (this.pool) {
      await this.pool.query(
        `UPDATE users SET hands_played = hands_played + 1 WHERE id = $1`,
        [userId],
      );
    } else {
      await this.persistFile();
    }
  }

  async applyHandsPlayedCounts(counts: Map<string, number>): Promise<void> {
    if (counts.size === 0) return;
    for (const [userId, n] of counts) {
      const user = this.users.get(userId);
      if (!user) continue;
      user.handsPlayed = Math.max(0, Math.floor(n));
    }
    if (this.pool) {
      for (const [userId, n] of counts) {
        if (!this.users.has(userId)) continue;
        await this.pool.query(`UPDATE users SET hands_played = $1 WHERE id = $2`, [
          Math.max(0, Math.floor(n)),
          userId,
        ]);
      }
    } else {
      await this.persistFile();
    }
  }

  getUserByUsername(username: string): User | undefined {
    const id = this.usernameIndex.get(username.trim().toLowerCase());
    return id ? this.users.get(id) : undefined;
  }

  getPublicUser(id: string): PublicUser | undefined {
    const u = this.users.get(id);
    return u ? toPublic(u) : undefined;
  }

  listUsers(): User[] {
    return [...this.users.values()];
  }

  /**
   * Permanently remove an account, its sessions, and WS tickets.
   * Username becomes available again. Returns the deleted user, or null if missing.
   */
  async deleteUser(userId: string): Promise<User | null> {
    await this.ensureLoaded();
    const user = this.users.get(userId);
    if (!user) return null;
    this.users.delete(userId);
    this.usernameIndex.delete(user.username.toLowerCase());
    this.unindexEmail(user);
    if (user.googleSub && this.googleSubIndex.get(user.googleSub) === userId) {
      this.googleSubIndex.delete(user.googleSub);
    }
    for (const [token, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(token);
    }
    for (const [ticket, wsTicket] of this.tickets) {
      if (wsTicket.userId === userId) this.tickets.delete(ticket);
    }
    for (const [hash, record] of this.emailTokens) {
      if (record.userId === userId) this.emailTokens.delete(hash);
    }
    if (this.pool) {
      await this.pool.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);
      await this.pool.query(`DELETE FROM auth_tickets WHERE user_id = $1`, [userId]);
      await this.pool.query(`DELETE FROM auth_email_tokens WHERE user_id = $1`, [userId]);
      await this.pool.query(`DELETE FROM table_chip_balances WHERE user_id = $1`, [userId]);
      await this.pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    } else {
      await this.persistFile();
    }
    return user;
  }

  issueTicket(userId: string, ttlMs = 7 * 24 * 60 * 60 * 1000, _persist = true): string {
    const ticket = randomBytes(24).toString('hex');
    this.tickets.set(ticket, { ticket, userId, expiresAt: Date.now() + ttlMs });
    return ticket;
  }

  async issueTicketAndPersist(userId: string, ttlMs = 7 * 24 * 60 * 60 * 1000): Promise<string> {
    const ticket = this.issueTicket(userId, ttlMs, false);
    const wsTicket = this.tickets.get(ticket)!;
    if (this.pool) {
      await this.upsertTicketPostgres(wsTicket);
      void this.maybeCleanupExpiredPostgres();
    } else {
      await this.persistFile();
    }
    return ticket;
  }

  consumeTicket(ticket: string): User | null {
    const t = this.tickets.get(ticket);
    if (!t) return null;
    if (Date.now() > t.expiresAt) {
      this.tickets.delete(ticket);
      return null;
    }
    return this.users.get(t.userId) ?? null;
  }

  async seedUser(
    id: string,
    username: string,
    password: string,
    avatarId = 0,
  ): Promise<User> {
    await this.ensureLoaded();
    const key = username.toLowerCase();
    if (this.usernameIndex.has(key) || this.users.has(id)) {
      throw new AuthError('username_taken', 'Username or id already taken');
    }
    const user = this.newUser(id, username, await argon2.hash(password), clampAvatarId(avatarId));
    this.indexUser(user);
    await this.persistUserToPostgres(user);
    await this.persistFile();
    return user;
  }
}
