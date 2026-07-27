import { randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';
import { avatarIdFromUserId, clampAvatarId } from './avatars.js';

export interface User {
  id: string;
  name: string;
  avatarId: number;
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

  /**
   * Register or refresh a session.
   * When `userId` is provided (Clerk `sub`), that id is the stable identity.
   */
  register(name: string, avatarId?: number, userId?: string): User {
    const trimmed = name.slice(0, 32);

    if (userId) {
      const existing = this.users.get(userId);
      if (existing) {
        existing.name = trimmed;
        if (avatarId !== undefined) existing.avatarId = clampAvatarId(avatarId);
        return existing;
      }

      const user: User = {
        id: userId,
        name: trimmed,
        avatarId: avatarId !== undefined ? clampAvatarId(avatarId) : avatarIdFromUserId(userId),
        createdAt: Date.now(),
      };
      this.users.set(user.id, user);
      return user;
    }

    const id = nanoid(12);
    const user: User = {
      id,
      name: trimmed,
      avatarId: avatarId !== undefined ? clampAvatarId(avatarId) : avatarIdFromUserId(id),
      createdAt: Date.now(),
    };
    this.users.set(user.id, user);
    return user;
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  /** All registered users (for friend search). */
  listUsers(): User[] {
    return [...this.users.values()];
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
    const user = this.users.get(t.userId);
    return user ?? null;
  }
}
