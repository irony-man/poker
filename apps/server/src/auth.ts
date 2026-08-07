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
    await mkdir(path.dirname(this.filePath), { recursive: true });

    if (this.pool) {
      await this.ensurePgSchema();
      await this.loadFromPostgres();
    } else {
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

  private async ensurePgSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT,
        username_lower TEXT,
        password_hash TEXT,
        avatar_id INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username_lower TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id INT NOT NULL DEFAULT 0;
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx
        ON users (username_lower) WHERE username_lower IS NOT NULL;
    `);
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
    // Sessions/tickets stay file-backed even with Postgres users
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const snap = JSON.parse(raw) as PersistedSnapshot;
      for (const s of snap.sessions ?? []) {
        if (s.expiresAt > Date.now()) this.sessions.set(s.token, s);
      }
      for (const t of snap.tickets ?? []) {
        if (t.expiresAt > Date.now()) this.tickets.set(t.ticket, t);
      }
    } catch {
      /* no local session file yet */
    }
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
  }

  private indexUser(user: User): void {
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username.toLowerCase(), user.id);
  }

  private async persist(): Promise<void> {
    const run = async () => {
      const snap: PersistedSnapshot = {
        users: [...this.users.values()],
        sessions: [...this.sessions.values()],
        tickets: [...this.tickets.values()],
      };

      if (this.pool) {
        // Users already upserted on write; keep sessions/tickets in the file.
        const sessionSnap: PersistedSnapshot = {
          users: [],
          sessions: snap.sessions,
          tickets: snap.tickets,
        };
        await this.writeAtomic(sessionSnap);
        return;
      }

      await this.writeAtomic(snap);
    };
    this.writeChain = this.writeChain.then(run, run);
    await this.writeChain;
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
    await this.persist();
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
    if (this.sessions.delete(token)) {
      await this.persist();
    }
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getPublicUser(id: string): PublicUser | undefined {
    const u = this.users.get(id);
    return u ? toPublic(u) : undefined;
  }

  /** All registered users (for friend search). */
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
    await this.persist();
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
    await this.persist();
    return user;
  }
}

/** Parse `Authorization: Bearer <token>`. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}
