import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { AuthStore, User } from './auth.js';

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: number;
}

export interface Challenge {
  id: string;
  challengerId: string;
  challengedId: string;
  tableId: string;
  inviteCode: string;
  status: 'pending' | 'joined' | 'expired';
  createdAt: number;
}

interface SocialSnapshot {
  requests: FriendRequest[];
  friendships: [string, string][];
  challenges: Challenge[];
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
  tableId: string;
  inviteCode: string;
  createdAt: number;
}

function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** File-backed friend requests, friendships, and challenges. */
export class FriendsStore {
  private requests: FriendRequest[] = [];
  private friendships = new Set<string>();
  private challenges: Challenge[] = [];
  private loaded = false;
  private readonly filePath: string;

  constructor(dataDir = path.join(process.cwd(), 'data')) {
    this.filePath = path.join(dataDir, 'social.json');
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const snap = JSON.parse(raw) as SocialSnapshot;
      this.requests = snap.requests ?? [];
      this.friendships = new Set(
        (snap.friendships ?? []).map(([a, b]) => `${a}:${b}`),
      );
      this.challenges = snap.challenges ?? [];
    } catch {
      this.requests = [];
      this.friendships = new Set();
      this.challenges = [];
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const snap: SocialSnapshot = {
      requests: this.requests,
      friendships: [...this.friendships].map((k) => {
        const [a, b] = k.split(':');
        return [a!, b!] as [string, string];
      }),
      challenges: this.challenges,
    };
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
      status: 'pending',
      createdAt: Date.now(),
    };
    this.challenges.push(challenge);
    await this.persist();
    return challenge;
  }

  async listPendingChallenges(
    auth: AuthStore,
    userId: string,
  ): Promise<PendingChallengeView[]> {
    await this.ensureLoaded();
    return this.challenges
      .filter((c) => c.challengedId === userId && c.status === 'pending')
      .map((c) => {
        const challenger = this.profile(auth, c.challengerId);
        if (!challenger) return null;
        return {
          id: c.id,
          challenger,
          tableId: c.tableId,
          inviteCode: c.inviteCode,
          createdAt: c.createdAt,
        };
      })
      .filter((v): v is PendingChallengeView => v !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async markChallengeJoined(challengeId: string, userId: string): Promise<void> {
    await this.ensureLoaded();
    const c = this.challenges.find((x) => x.id === challengeId);
    if (!c || c.challengedId !== userId) return;
    c.status = 'joined';
    await this.persist();
  }

  searchUsers(auth: AuthStore, query: string, excludeUserId: string, limit = 8): User[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: User[] = [];
    for (const user of auth.listUsers()) {
      if (user.id === excludeUserId) continue;
      if (user.name.toLowerCase().includes(q) || user.id.toLowerCase().includes(q)) {
        results.push(user);
        if (results.length >= limit) break;
      }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }
}
