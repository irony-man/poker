import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { AuthStore } from '../auth/auth.store.js';
import type { User } from '../auth/auth.types.js';
import type { Queryable } from '../database/queryable.js';

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: number;
}

export type ChallengeKind = 'table' | 'contest';

export interface Challenge {
  id: string;
  challengerId: string;
  challengedId: string;
  /** Cash/private table id (empty string for pure contest invites). */
  tableId: string;
  /** Contest registration invite target. */
  contestId?: string;
  inviteCode: string;
  /** Defaults to table when omitted (legacy snapshots). */
  kind?: ChallengeKind;
  status: 'pending' | 'joined' | 'expired' | 'declined';
  createdAt: number;
  /** Present when this challenge was created via a group quick-invite. */
  groupId?: string;
  groupName?: string;
}

export interface FriendGroup {
  id: string;
  ownerUserId: string;
  name: string;
  /** Friend user ids excluding owner. */
  memberUserIds: string[];
  createdAt: number;
}

interface SocialSnapshot {
  requests: FriendRequest[];
  friendships: [string, string][];
  challenges: Challenge[];
  groups?: FriendGroup[];
}

export interface FriendProfile {
  userId: string;
  name: string;
  avatarId: number;
}

export interface PendingRequestView {
  id: string;
  from: FriendProfile;
  createdAt: number;
}

export interface PendingChallengeView {
  id: string;
  challenger: FriendProfile;
  kind: ChallengeKind;
  tableId: string | null;
  contestId: string | null;
  inviteCode: string;
  createdAt: number;
  groupId?: string;
  groupName?: string;
}

export interface FriendGroupView {
  id: string;
  name: string;
  ownerUserId: string;
  isOwner: boolean;
  members: FriendProfile[];
  createdAt: number;
}

function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Game invites / challenges auto-drop if unanswered. */
export const CHALLENGE_TTL_MS = 2 * 60 * 1000;

/** Social graph — Postgres (social_store) when pool is set, else data/social.json. */
export class FriendsStore {
  private requests: FriendRequest[] = [];
  private friendships = new Set<string>();
  private challenges: Challenge[] = [];
  private groups: FriendGroup[] = [];
  private loaded = false;
  private readonly filePath: string;
  private pool: Queryable | null = null;

  constructor(dataDir = path.join(process.cwd(), 'data'), pool: Queryable | null = null) {
    this.filePath = path.join(dataDir, 'social.json');
    this.pool = pool;
  }

  setPool(pool: Queryable | null): void {
    this.pool = pool;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.pool) {
      await this.loadFromPostgres();
    } else {
      await this.loadFromFile();
    }
    this.loaded = true;
  }

  private applySnapshot(snap: SocialSnapshot): void {
    this.requests = snap.requests ?? [];
    this.friendships = new Set((snap.friendships ?? []).map(([a, b]) => `${a}:${b}`));
    this.challenges = snap.challenges ?? [];
    this.groups = snap.groups ?? [];
  }

  private snapshot(): SocialSnapshot {
    return {
      requests: this.requests,
      friendships: [...this.friendships].map((k) => {
        const [a, b] = k.split(':');
        return [a!, b!] as [string, string];
      }),
      challenges: this.challenges,
      groups: this.groups,
    };
  }

  private async loadFromFile(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.applySnapshot(JSON.parse(raw) as SocialSnapshot);
    } catch {
      this.applySnapshot({ requests: [], friendships: [], challenges: [], groups: [] });
    }
  }

  private async loadFromPostgres(): Promise<void> {
    if (!this.pool) return;
    const res = await this.pool.query(
      `SELECT payload FROM social_store WHERE id = 'default'`,
    );
    const row = (res.rows[0] as { payload?: SocialSnapshot } | undefined);
    if (row?.payload) {
      this.applySnapshot(row.payload);
    } else {
      this.applySnapshot({ requests: [], friendships: [], challenges: [], groups: [] });
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    const snap = this.snapshot();
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO social_store (id, payload, updated_at)
         VALUES ('default', $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET
           payload = EXCLUDED.payload,
           updated_at = NOW()`,
        [JSON.stringify(snap)],
      );
      return;
    }
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snap, null, 2), 'utf8');
  }

  private profile(auth: AuthStore, userId: string): FriendProfile | null {
    const user = auth.getUser(userId);
    if (!user) return null;
    return { userId: user.id, name: user.name, avatarId: user.avatarId };
  }

  private areFriends(a: string, b: string): boolean {
    const [x, y] = pairKey(a, b);
    return this.friendships.has(`${x}:${y}`);
  }

  async sendRequest(fromUserId: string, toUserId: string): Promise<FriendRequest> {
    await this.ensureLoaded();
    if (fromUserId === toUserId) {
      throw new Error('Cannot add yourself');
    }
    if (this.areFriends(fromUserId, toUserId)) {
      throw new Error('Already friends');
    }
    const existing = this.requests.find(
      (r) =>
        r.status === 'pending' &&
        ((r.fromUserId === fromUserId && r.toUserId === toUserId) ||
          (r.fromUserId === toUserId && r.toUserId === fromUserId)),
    );
    if (existing) {
      throw new Error('Friend request already pending');
    }

    const req: FriendRequest = {
      id: nanoid(10),
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.requests.push(req);
    await this.persist();
    return req;
  }

  async respondRequest(
    userId: string,
    requestId: string,
    accept: boolean,
  ): Promise<{ ok: true; friend?: FriendProfile } | { ok: false; error: string }> {
    await this.ensureLoaded();
    const req = this.requests.find((r) => r.id === requestId);
    if (!req || req.toUserId !== userId || req.status !== 'pending') {
      return { ok: false, error: 'Request not found' };
    }
    req.status = accept ? 'accepted' : 'declined';
    if (accept) {
      const [a, b] = pairKey(req.fromUserId, req.toUserId);
      this.friendships.add(`${a}:${b}`);
    }
    await this.persist();
    return { ok: true };
  }

  async removeFriend(
    userId: string,
    friendUserId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    await this.ensureLoaded();
    if (!friendUserId || userId === friendUserId) {
      return { ok: false, error: 'Invalid user' };
    }
    const [a, b] = pairKey(userId, friendUserId);
    const key = `${a}:${b}`;
    if (!this.friendships.has(key)) {
      return { ok: false, error: 'Not friends' };
    }
    this.friendships.delete(key);
    // Drop each person from the other’s owned groups.
    for (const g of this.groups) {
      if (g.ownerUserId === userId) {
        g.memberUserIds = g.memberUserIds.filter((id) => id !== friendUserId);
      } else if (g.ownerUserId === friendUserId) {
        g.memberUserIds = g.memberUserIds.filter((id) => id !== userId);
      }
    }
    // Expire open challenges between the pair.
    for (const c of this.challenges) {
      if (c.status !== 'pending') continue;
      const pair =
        (c.challengerId === userId && c.challengedId === friendUserId) ||
        (c.challengerId === friendUserId && c.challengedId === userId);
      if (pair) c.status = 'expired';
    }
    await this.persist();
    return { ok: true };
  }

  async listFriends(auth: AuthStore, userId: string): Promise<FriendProfile[]> {
    await this.ensureLoaded();
    const ids = new Set<string>();
    for (const key of this.friendships) {
      const [a, b] = key.split(':');
      if (a === userId) ids.add(b!);
      else if (b === userId) ids.add(a!);
    }
    const out: FriendProfile[] = [];
    for (const id of ids) {
      const p = this.profile(auth, id);
      if (p) out.push(p);
    }
    return out.sort((x, y) => x.name.localeCompare(y.name));
  }

  async listIncomingRequests(
    auth: AuthStore,
    userId: string,
  ): Promise<PendingRequestView[]> {
    await this.ensureLoaded();
    return this.requests
      .filter((r) => r.toUserId === userId && r.status === 'pending')
      .map((r) => {
        const from = this.profile(auth, r.fromUserId);
        if (!from) return null;
        return { id: r.id, from, createdAt: r.createdAt };
      })
      .filter((v): v is PendingRequestView => v !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async createChallenge(
    challengerId: string,
    challengedId: string,
    tableId: string,
    inviteCode: string,
    extra?: { groupId?: string; groupName?: string },
  ): Promise<Challenge> {
    await this.ensureLoaded();
    if (!this.areFriends(challengerId, challengedId)) {
      throw new Error('Can only challenge friends');
    }
    const challenge: Challenge = {
      id: nanoid(10),
      challengerId,
      challengedId,
      tableId,
      inviteCode,
      kind: 'table',
      status: 'pending',
      createdAt: Date.now(),
      groupId: extra?.groupId,
      groupName: extra?.groupName,
    };
    this.challenges.push(challenge);
    await this.persist();
    return challenge;
  }

  /**
   * Notify friends of a private table or contest. Skips non-friends / self.
   * Replaces an existing pending invite to the same target for the same friend.
   */
  async createFriendInvites(
    hostUserId: string,
    friendUserIds: string[],
    target:
      | { kind: 'table'; tableId: string; inviteCode: string }
      | { kind: 'contest'; contestId: string; inviteCode: string },
  ): Promise<Challenge[]> {
    await this.ensureLoaded();
    const unique = [...new Set(friendUserIds)].filter((id) => id !== hostUserId);
    const created: Challenge[] = [];
    for (const targetId of unique) {
      if (!this.areFriends(hostUserId, targetId)) continue;

      // Drop older pending invite from this host for the same destination.
      this.challenges = this.challenges.filter((c) => {
        if (c.challengerId !== hostUserId || c.challengedId !== targetId || c.status !== 'pending') {
          return true;
        }
        if (target.kind === 'table') {
          return !(c.kind !== 'contest' && c.tableId === target.tableId);
        }
        return c.contestId !== target.contestId;
      });

      const challenge: Challenge =
        target.kind === 'table'
          ? {
              id: nanoid(10),
              challengerId: hostUserId,
              challengedId: targetId,
              tableId: target.tableId,
              inviteCode: target.inviteCode,
              kind: 'table',
              status: 'pending',
              createdAt: Date.now(),
            }
          : {
              id: nanoid(10),
              challengerId: hostUserId,
              challengedId: targetId,
              tableId: '',
              contestId: target.contestId,
              inviteCode: target.inviteCode,
              kind: 'contest',
              status: 'pending',
              createdAt: Date.now(),
            };
      this.challenges.push(challenge);
      created.push(challenge);
    }
    if (created.length > 0) await this.persist();
    return created;
  }

  async listPendingChallenges(
    auth: AuthStore,
    userId: string,
  ): Promise<PendingChallengeView[]> {
    await this.ensureLoaded();
    await this.expireStaleChallenges();
    const out: PendingChallengeView[] = [];
    for (const c of this.challenges) {
      if (c.challengedId !== userId || c.status !== 'pending') continue;
      const challenger = this.profile(auth, c.challengerId);
      if (!challenger) continue;
      const kind: ChallengeKind =
        c.kind ?? (c.contestId ? 'contest' : 'table');
      out.push({
        id: c.id,
        challenger,
        kind,
        tableId: c.tableId || null,
        contestId: c.contestId ?? null,
        inviteCode: c.inviteCode,
        createdAt: c.createdAt,
        ...(c.groupId ? { groupId: c.groupId } : {}),
        ...(c.groupName ? { groupName: c.groupName } : {}),
      });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Mark pending invites older than {@link CHALLENGE_TTL_MS} as expired. */
  private async expireStaleChallenges(now: number = Date.now()): Promise<number> {
    const cutoff = now - CHALLENGE_TTL_MS;
    let n = 0;
    for (const c of this.challenges) {
      if (c.status !== 'pending') continue;
      if (c.createdAt > cutoff) continue;
      c.status = 'expired';
      n += 1;
    }
    if (n > 0) await this.persist();
    return n;
  }

  async markChallengeJoined(
    challengeId: string,
    userId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    await this.ensureLoaded();
    await this.expireStaleChallenges();
    const c = this.challenges.find((x) => x.id === challengeId);
    if (!c || c.challengedId !== userId) {
      return { ok: false, error: 'Invite not found' };
    }
    if (c.status !== 'pending') {
      return { ok: false, error: 'Invite has expired or is no longer pending' };
    }
    c.status = 'joined';
    await this.persist();
    return { ok: true };
  }

  /** Challenged player declines a pending table/contest invite. */
  async declineChallenge(
    challengeId: string,
    userId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    await this.ensureLoaded();
    await this.expireStaleChallenges();
    const c = this.challenges.find((x) => x.id === challengeId);
    if (!c || c.challengedId !== userId) {
      return { ok: false, error: 'Invite not found' };
    }
    if (c.status !== 'pending') {
      return { ok: false, error: 'Invite is no longer pending' };
    }
    c.status = 'declined';
    await this.persist();
    return { ok: true };
  }

  private groupView(auth: AuthStore, group: FriendGroup, viewerId: string): FriendGroupView {
    const owner = this.profile(auth, group.ownerUserId);
    const others: FriendProfile[] = [];
    for (const id of group.memberUserIds) {
      if (id === group.ownerUserId) continue;
      const p = this.profile(auth, id);
      if (p) others.push(p);
    }
    others.sort((a, b) => a.name.localeCompare(b.name));
    return {
      id: group.id,
      name: group.name,
      ownerUserId: group.ownerUserId,
      isOwner: group.ownerUserId === viewerId,
      members: owner ? [owner, ...others] : others,
      createdAt: group.createdAt,
    };
  }

  async listGroups(auth: AuthStore, userId: string): Promise<FriendGroupView[]> {
    await this.ensureLoaded();
    return this.groups
      .filter((g) => g.ownerUserId === userId || g.memberUserIds.includes(userId))
      .map((g) => this.groupView(auth, g, userId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createGroup(
    auth: AuthStore,
    ownerUserId: string,
    name: string,
    memberUserIds: string[],
  ): Promise<FriendGroupView> {
    await this.ensureLoaded();
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) throw new Error('Group name required');

    const unique = [...new Set(memberUserIds.filter((id) => id !== ownerUserId))];
    if (unique.length > 8) throw new Error('Max 8 friends per group');
    for (const id of unique) {
      if (!this.areFriends(ownerUserId, id)) {
        throw new Error('All members must be friends');
      }
      if (!auth.getUser(id)) {
        throw new Error('Player not found');
      }
    }

    const group: FriendGroup = {
      id: nanoid(10),
      ownerUserId,
      name: trimmed,
      memberUserIds: unique,
      createdAt: Date.now(),
    };
    this.groups.push(group);
    await this.persist();
    return this.groupView(auth, group, ownerUserId);
  }

  async updateGroup(
    auth: AuthStore,
    userId: string,
    groupId: string,
    patch: { name?: string; memberUserIds?: string[] },
  ): Promise<FriendGroupView> {
    await this.ensureLoaded();
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) throw new Error('Group not found');
    if (group.ownerUserId !== userId) throw new Error('Only the owner can edit this group');

    if (patch.name !== undefined) {
      const trimmed = patch.name.trim().slice(0, 40);
      if (!trimmed) throw new Error('Group name required');
      group.name = trimmed;
    }
    if (patch.memberUserIds !== undefined) {
      const unique = [...new Set(patch.memberUserIds.filter((id) => id !== userId))];
      if (unique.length > 8) throw new Error('Max 8 friends per group');
      for (const id of unique) {
        if (!this.areFriends(userId, id)) {
          throw new Error('All members must be friends');
        }
        if (!auth.getUser(id)) {
          throw new Error('Player not found');
        }
      }
      group.memberUserIds = unique;
    }
    await this.persist();
    return this.groupView(auth, group, userId);
  }

  async deleteGroup(userId: string, groupId: string): Promise<void> {
    await this.ensureLoaded();
    const idx = this.groups.findIndex((g) => g.id === groupId);
    if (idx < 0) throw new Error('Group not found');
    if (this.groups[idx]!.ownerUserId !== userId) {
      throw new Error('Only the owner can delete this group');
    }
    this.groups.splice(idx, 1);
    await this.persist();
  }

  getGroup(groupId: string): FriendGroup | undefined {
    return this.groups.find((g) => g.id === groupId);
  }

  /** Ensure loaded then return group (for invite path without reloading). */
  async requireGroup(groupId: string): Promise<FriendGroup> {
    await this.ensureLoaded();
    const group = this.groups.find((g) => g.id === groupId);
    if (!group) throw new Error('Group not found');
    return group;
  }

  /**
   * Create a pending challenge invite for each invitee on the same table.
   * Host must be the group owner or a member.
   */
  async createGroupGameInvites(
    hostUserId: string,
    group: FriendGroup,
    inviteeIds: string[],
    tableId: string,
    inviteCode: string,
  ): Promise<Challenge[]> {
    await this.ensureLoaded();
    const isInGroup =
      group.ownerUserId === hostUserId || group.memberUserIds.includes(hostUserId);
    if (!isInGroup) throw new Error('You are not in this group');

    const targets = [...new Set(inviteeIds)].filter((id) => id !== hostUserId);
    if (targets.length === 0) throw new Error('Add friends to this group before starting a table');

    const created: Challenge[] = [];
    for (const targetId of targets) {
      // Skip stale entries (unfriended / removed) instead of failing the whole group invite.
      if (!this.areFriends(hostUserId, targetId)) continue;
      const inGroup =
        group.ownerUserId === targetId || group.memberUserIds.includes(targetId);
      if (!inGroup) continue;
      const challenge: Challenge = {
        id: nanoid(10),
        challengerId: hostUserId,
        challengedId: targetId,
        tableId,
        inviteCode,
        kind: 'table',
        status: 'pending',
        createdAt: Date.now(),
        groupId: group.id,
        groupName: group.name,
      };
      this.challenges.push(challenge);
      created.push(challenge);
    }
    if (created.length === 0) {
      throw new Error('No friends available to invite — update group members first');
    }
    await this.persist();
    return created;
  }

  /** Exact case-insensitive username match (not partial). */
  searchUsers(auth: AuthStore, query: string, excludeUserId: string): User[] {
    const q = query.trim();
    if (!q) return [];
    const user = auth.getUserByUsername(q);
    if (!user || user.id === excludeUserId) return [];
    return [user];
  }
}
