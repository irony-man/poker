import { Injectable } from '@nestjs/common';

/**
 * In-memory "who's browsing right now" for friend invite UX.
 * Clients ping while signed in; table WS auth also counts.
 */
@Injectable()
export class PresenceService {
  /** userId -> last activity ms */
  private readonly lastSeen = new Map<string, number>();

  /** Consider online if active within this window. */
  static readonly ONLINE_MS = 75_000;

  touch(userId: string): void {
    if (!userId) return;
    this.lastSeen.set(userId, Date.now());
  }

  /** Immediately mark offline (e.g. last WS socket closed). */
  clear(userId: string): void {
    if (!userId) return;
    this.lastSeen.delete(userId);
  }

  isOnline(userId: string): boolean {
    const t = this.lastSeen.get(userId);
    if (t == null) return false;
    return Date.now() - t < PresenceService.ONLINE_MS;
  }

  /** Drop very old entries occasionally (optional). */
  prune(): void {
    const cutoff = Date.now() - PresenceService.ONLINE_MS * 4;
    for (const [id, t] of this.lastSeen) {
      if (t < cutoff) this.lastSeen.delete(id);
    }
  }
}
