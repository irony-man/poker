import { Injectable } from '@nestjs/common';

export type SocketSend = (msg: unknown) => void;

/**
 * Process-local WS fan-out for lobby / social push messages.
 * Gateway registers connections; domain services request broadcasts.
 */
@Injectable()
export class RealtimeService {
  private readonly allSends = new Set<SocketSend>();
  private readonly userSends = new Map<string, Set<SocketSend>>();

  private publicTables: unknown[] = [];
  private publicContests: unknown[] = [];
  private socialLoader: ((userId: string) => Promise<unknown>) | null = null;
  private myContestsLoader: ((userId: string) => unknown[]) | null = null;
  private friendIdsLoader: ((userId: string) => Promise<string[]>) | null = null;

  private publicTablesTimer: ReturnType<typeof setTimeout> | null = null;
  private publicContestsTimer: ReturnType<typeof setTimeout> | null = null;

  setPublicTables(tables: unknown[]): void {
    this.publicTables = tables;
  }

  setPublicContests(contests: unknown[]): void {
    this.publicContests = contests;
  }

  setSocialLoader(loader: (userId: string) => Promise<unknown>): void {
    this.socialLoader = loader;
  }

  setMyContestsLoader(loader: (userId: string) => unknown[]): void {
    this.myContestsLoader = loader;
  }

  setFriendIdsLoader(loader: (userId: string) => Promise<string[]>): void {
    this.friendIdsLoader = loader;
  }

  registerSocket(send: SocketSend): void {
    this.allSends.add(send);
  }

  /**
   * Drop a socket. Returns true when the user loses their last registered connection
   * (used to clear presence immediately).
   */
  unregisterSocket(send: SocketSend, userId: string | null): boolean {
    this.allSends.delete(send);
    if (!userId) return false;
    const set = this.userSends.get(userId);
    if (!set) return false;
    set.delete(send);
    if (set.size === 0) {
      this.userSends.delete(userId);
      return true;
    }
    return false;
  }

  /** Associate an already-registered send with a user after auth. */
  registerUser(userId: string, send: SocketSend): boolean {
    let set = this.userSends.get(userId);
    if (!set) {
      set = new Set();
      this.userSends.set(userId, set);
    }
    const first = set.size === 0;
    set.add(send);
    return first;
  }

  isUserConnected(userId: string): boolean {
    const set = this.userSends.get(userId);
    return Boolean(set && set.size > 0);
  }

  sendToUser(userId: string, msg: unknown): void {
    const set = this.userSends.get(userId);
    if (!set) return;
    for (const send of set) {
      try {
        send(msg);
      } catch {
        /* ignore dead sockets */
      }
    }
  }

  broadcastAll(msg: unknown): void {
    for (const send of this.allSends) {
      try {
        send(msg);
      } catch {
        /* ignore */
      }
    }
  }

  /** Initial public lobby snapshot for a newly connected socket. */
  sendPublicLobby(send: SocketSend): void {
    send({ type: 'public_tables_sync', tables: this.publicTables });
    send({ type: 'public_contests_sync', contests: this.publicContests });
  }

  async sendAuthSnapshots(userId: string, send: SocketSend): Promise<void> {
    if (this.socialLoader) {
      try {
        const payload = await this.socialLoader(userId);
        send(payload);
      } catch {
        /* ignore social load failures on auth */
      }
    }
    if (this.myContestsLoader) {
      try {
        send({
          type: 'my_contests_sync',
          contests: this.myContestsLoader(userId),
        });
      } catch {
        /* ignore */
      }
    }
  }

  async pushSocial(userId: string): Promise<void> {
    if (!this.socialLoader) return;
    try {
      const payload = await this.socialLoader(userId);
      this.sendToUser(userId, payload);
    } catch {
      /* ignore */
    }
  }

  /** Re-send social_sync to each friend of `userId` (e.g. presence change). */
  async pushSocialToFriendsOf(userId: string): Promise<void> {
    if (!this.friendIdsLoader) return;
    let ids: string[] = [];
    try {
      ids = await this.friendIdsLoader(userId);
    } catch {
      return;
    }
    await Promise.all(ids.map((id) => this.pushSocial(id)));
  }

  pushMyContests(userId: string): void {
    if (!this.myContestsLoader) return;
    try {
      this.sendToUser(userId, {
        type: 'my_contests_sync',
        contests: this.myContestsLoader(userId),
      });
    } catch {
      /* ignore */
    }
  }

  /** Debounced fan-out of public tables (seating churn). */
  schedulePublicTablesBroadcast(tables: unknown[]): void {
    this.publicTables = tables;
    if (this.publicTablesTimer) clearTimeout(this.publicTablesTimer);
    this.publicTablesTimer = setTimeout(() => {
      this.publicTablesTimer = null;
      this.broadcastAll({ type: 'public_tables_sync', tables: this.publicTables });
    }, 50);
  }

  schedulePublicContestsBroadcast(contests: unknown[]): void {
    this.publicContests = contests;
    if (this.publicContestsTimer) clearTimeout(this.publicContestsTimer);
    this.publicContestsTimer = setTimeout(() => {
      this.publicContestsTimer = null;
      this.broadcastAll({ type: 'public_contests_sync', contests: this.publicContests });
    }, 50);
  }

  /** Push public list + mine for entrants/host. */
  notifyContestLists(publicContests: unknown[], userIds: string[]): void {
    this.schedulePublicContestsBroadcast(publicContests);
    const unique = new Set(userIds);
    for (const id of unique) {
      this.pushMyContests(id);
    }
  }
}
