import { randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';

export interface User {
  id: string;
  name: string;
  createdAt: number;
}

export interface WsTicket {
  ticket: string;
  userId: string;
  expiresAt: number;
}

/** In-memory user + ticket store (swap for Postgres/Redis in production). */
export class AuthStore {
  private users = new Map<string, User>();
  private tickets = new Map<string, WsTicket>();
  private nameIndex = new Map<string, string>();

  register(name: string): User {
    const existing = this.nameIndex.get(name.toLowerCase());
    if (existing) return this.users.get(existing)!;

    const user: User = { id: nanoid(12), name, createdAt: Date.now() };
    this.users.set(user.id, user);
    this.nameIndex.set(name.toLowerCase(), user.id);
    return user;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  /** Short-lived WS ticket (refresh on every page load / register). */
  issueTicket(userId: string, ttlMs = 7 * 24 * 60 * 60 * 1000): string {
    const ticket = randomBytes(24).toString('hex');
    this.tickets.set(ticket, { ticket, userId, expiresAt: Date.now() + ttlMs });
    return ticket;
  }

  consumeTicket(ticket: string): User | null {
    const t = this.tickets.get(ticket);
    if (!t) return null;
    if (Date.now() > t.expiresAt) {
      this.tickets.delete(ticket);
      return null;
    }
    // Allow reuse within TTL for reconnects; delete after long idle via expiry
    const user = this.users.get(t.userId);
    return user ?? null;
  }
}
