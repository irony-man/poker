import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { avatarIdFromUserId, clampAvatarId } from './avatars.js';

export interface User {
  id: string;
  /** Stored with original casing; unique case-insensitively. */
  username: string;
  /** Display name — always equals username. */
  name: string;
  avatarId: number;
  passwordHash: string;
  createdAt: number;
}

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  avatarId: number;
  createdAt: number;
}

export interface WsTicket {
  ticket: string;
  userId: string;
  expiresAt: number;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface AuthSessionPayload {
  userId: string;
  username: string;
  name: string;
  ticket: string;
  sessionToken: string;
  avatarId: number;
}

interface PersistedSnapshot {
  users: User[];
  sessions: Session[];
  tickets: WsTicket[];
}

export type AuthErrorCode = 'username_taken' | 'invalid_credentials' | 'invalid_username';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function toPublic(u: User): PublicUser {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatarId: u.avatarId,
    createdAt: u.createdAt,
  };
}

/** File-backed (or Postgres-backed) user + session + ticket store. */
export class AuthStore {
  private users = new Map<string, User>();
  private usernameIndex = new Map<string, string>(); // lower -> id
  private tickets = new Map<string, WsTicket>();
  private sessions = new Map<string, Session>();
  private loaded = false;
  private readonly filePath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(dataDir = path.join(process.cwd(), 'data')) {
    this.filePath = path.join(dataDir, 'users.json');
  }

  /** Attach a pg pool for Postgres user persistence (optional). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPool(pool: any | null): void {
    this.pool = pool;
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
      this.users.clear();
      this.usernameIndex.clear();
      this.sessions.clear();
      this.tickets.clear();
      for (const u of snap.users ?? []) {
        this.indexUser(u);
      }
      for (const s of snap.sessions ?? []) {
        if (s.expiresAt > Date.now()) this.sessions.set(s.token, s);
      }
      for (const t of snap.tickets ?? []) {
        if (t.expiresAt > Date.now()) this.tickets.set(t.ticket, t);
      }
    } catch {
      this.users.clear();
      this.usernameIndex.clear();
      this.sessions.clear();
      this.tickets.clear();
    }
  }

  private async loadFromPostgres(): Promise<void> {
    if (!this.pool) return;
    const result = await this.pool.query(
      `SELECT id, name, username, password_hash, avatar_id, created_at
       FROM users
       WHERE password_hash IS NOT NULL AND username IS NOT NULL`,
    );
    this.users.clear();
    this.usernameIndex.clear();
    this.sessions.clear();
    this.tickets.clear();

    for (const row of result.rows as {
      id: string;
      name: string;
      username: string;
      password_hash: string;
      avatar_id: number;
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
        passwordHash: row.password_hash,
        avatarId: clampAvatarId(row.avatar_id ?? 0),
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
  }

  /** Full JSON snapshot — file-backed mode only. */
  private async persistFile(): Promise<void> {
    if (this.pool) return;
    const run = async () => {
      const snap: PersistedSnapshot = {
        users: [...this.users.values()],
        sessions: [...this.sessions.values()],
        tickets: [...this.tickets.values()],
      };
      await this.writeAtomic(snap);
    };
    this.writeChain = this.writeChain.then(run, run);
    await this.writeChain;
  }

  private lastExpiredCleanupAt = 0;
  private static readonly EXPIRED_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

  /** Throttled expired-row cleanup so login is not O(table-size). */
  private async maybeCleanupExpiredPostgres(): Promise<void> {
    if (!this.pool) return;
    const now = Date.now();
    if (now - this.lastExpiredCleanupAt < AuthStore.EXPIRED_CLEANUP_INTERVAL_MS) return;
    this.lastExpiredCleanupAt = now;
    // Drop expired from memory too (cheap; avoids map growth between restarts).
    for (const [token, s] of this.sessions) {
      if (s.expiresAt <= now) this.sessions.delete(token);
    }
    for (const [ticket, t] of this.tickets) {
      if (t.expiresAt <= now) this.tickets.delete(ticket);
    }
    await Promise.all([
      this.pool.query(`DELETE FROM auth_sessions WHERE expires_at <= NOW()`),
      this.pool.query(`DELETE FROM auth_tickets WHERE expires_at <= NOW()`),
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
      `INSERT INTO users (id, name, username, username_lower, password_hash, avatar_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         username = EXCLUDED.username,
         username_lower = EXCLUDED.username_lower,
         password_hash = EXCLUDED.password_hash,
         avatar_id = EXCLUDED.avatar_id`,
      [
        user.id,
        user.name,
        user.username,
        user.username.toLowerCase(),
        user.passwordHash,
        user.avatarId,
        user.createdAt,
      ],
    );
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
    const user: User = {
      id,
      username: trimmed,
      name: trimmed,
      passwordHash: await argon2.hash(password),
      avatarId: avatarId !== undefined ? clampAvatarId(avatarId) : avatarIdFromUserId(id),
      createdAt: Date.now(),
    };
    this.indexUser(user);
    await this.persistUserToPostgres(user);
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
    try {
      ok = await argon2.verify(user.passwordHash, password);
    } catch {
      ok = false;
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
      // Fire-and-forget throttled cleanup; do not block login on table scans.
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
    };
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

  /** Case-insensitive exact username lookup. */
  getUserByUsername(username: string): User | undefined {
    const id = this.usernameIndex.get(username.trim().toLowerCase());
    return id ? this.users.get(id) : undefined;
  }

  getPublicUser(id: string): PublicUser | undefined {
    const u = this.users.get(id);
    return u ? toPublic(u) : undefined;
  }

  /** All registered users. */
  listUsers(): User[] {
    return [...this.users.values()];
  }

  issueTicket(userId: string, ttlMs = 7 * 24 * 60 * 60 * 1000, persist = true): string {
    const ticket = randomBytes(24).toString('hex');
    this.tickets.set(ticket, { ticket, userId, expiresAt: Date.now() + ttlMs });
    if (persist) {
      // Caller may await saveTickets() when needed; sync path for ticket endpoint uses issueTicketAndPersist.
    }
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

  /**
   * Seed a user for unit tests (fixed id, known password).
   * Not for production use.
   */
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
    const user: User = {
      id,
      username,
      name: username,
      passwordHash: await argon2.hash(password),
      avatarId: clampAvatarId(avatarId),
      createdAt: Date.now(),
    };
    this.indexUser(user);
    await this.persistUserToPostgres(user);
    await this.persistFile();
    return user;
  }
}

/** Parse `Authorization: Bearer <token>`. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}
