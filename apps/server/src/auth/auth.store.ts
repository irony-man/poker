import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';
import type { Queryable } from '../database/queryable.js';
import { avatarIdFromUserId, clampAvatarId } from '../avatars.js';
import { clampTableColorId } from '../table-colors.js';
import {
  defaultEconomy,
  type EconomyProvider,
  STARTING_CHIP_GRANT,
} from '../wallet/wallet.constants.js';
import {
  AuthError,
  type AuthSessionPayload,
  type PublicUser,
  type Session,
  type User,
  type WsTicket,
} from './auth.types.js';

interface PersistedSnapshot {
  users: User[];
  sessions: Session[];
  tickets: WsTicket[];
}

function toPublic(u: User): PublicUser {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    avatarId: u.avatarId,
    tableColorId: u.tableColorId,
    createdAt: u.createdAt,
    chipBalance: u.chipBalance,
  };
}

function normalizeUser(u: User, fallbackBalance = STARTING_CHIP_GRANT): User {
  return {
    ...u,
    avatarId: clampAvatarId(u.avatarId),
    tableColorId: clampTableColorId(u.tableColorId),
    chipBalance: normalizeChipBalance(u.chipBalance, fallbackBalance),
  };
}

function normalizeChipBalance(value: unknown, fallback = STARTING_CHIP_GRANT): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return fallback;
}

/** File-backed (or Postgres-backed via Queryable) user + session + ticket store. */
export class AuthStore {
  private users = new Map<string, User>();
  private usernameIndex = new Map<string, string>(); // lower -> id
  private tickets = new Map<string, WsTicket>();
  private sessions = new Map<string, Session>();
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
        this.indexUser(
          normalizeUser({
            ...u,
            tableColorId: (u as User).tableColorId ?? 0,
            chipBalance: normalizeChipBalance((u as User).chipBalance),
          }),
        );
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
      `SELECT id, name, username, password_hash, avatar_id, table_color_id, chip_balance, created_at
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
      table_color_id?: number | null;
      chip_balance?: number | null;
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
        tableColorId: clampTableColorId(row.table_color_id ?? 0),
        chipBalance: normalizeChipBalance(row.chip_balance),
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
      `INSERT INTO users (id, name, username, username_lower, password_hash, avatar_id, table_color_id, chip_balance, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9 / 1000.0))
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         username = EXCLUDED.username,
         username_lower = EXCLUDED.username_lower,
         password_hash = EXCLUDED.password_hash,
         avatar_id = EXCLUDED.avatar_id,
         table_color_id = EXCLUDED.table_color_id,
         chip_balance = EXCLUDED.chip_balance`,
      [
        user.id,
        user.name,
        user.username,
        user.username.toLowerCase(),
        user.passwordHash,
        user.avatarId,
        user.tableColorId,
        user.chipBalance,
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
      tableColorId: 0,
      chipBalance: this.startingGrant(),
      createdAt: Date.now(),
    };
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
      chipBalance: user.chipBalance,
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

  async setAvatarId(userId: string, avatarId: number): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    user.avatarId = clampAvatarId(avatarId);
    if (this.pool) {
      await this.pool.query(`UPDATE users SET avatar_id = $1 WHERE id = $2`, [
        user.avatarId,
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
    const user: User = {
      id,
      username,
      name: username,
      passwordHash: await argon2.hash(password),
      avatarId: clampAvatarId(avatarId),
      tableColorId: 0,
      chipBalance: this.startingGrant(),
      createdAt: Date.now(),
    };
    this.indexUser(user);
    await this.persistUserToPostgres(user);
    await this.persistFile();
    return user;
  }
}
