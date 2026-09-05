import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from './auth/auth.store.js';
import { CHALLENGE_TTL_MS, FriendsStore } from './friends/friends.store.js';

describe('FriendsStore', () => {
  const dir = path.join(process.cwd(), '.test-social');
  let auth: AuthStore;
  let friends: FriendsStore;

  beforeEach(async () => {
    await mkdir(dir, { recursive: true });
    auth = new AuthStore(path.join(dir, 'auth'));
    await auth.init();
    await auth.seedUser('user-alice', 'Alice', 'password1', 0);
    await auth.seedUser('user-bob', 'Bob', 'password1', 1);
    await auth.seedUser('user-carol', 'Carol', 'password1', 2);
    friends = new FriendsStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('sends and accepts friend requests', async () => {
    const req = await friends.sendRequest('user-alice', 'user-bob');
    expect(req.status).toBe('pending');

    const incoming = await friends.listIncomingRequests(auth, 'user-bob');
    expect(incoming).toHaveLength(1);
    expect(incoming[0]!.from.name).toBe('Alice');

    const result = await friends.respondRequest('user-bob', req.id, true);
    expect(result.ok).toBe(true);

    const aliceFriends = await friends.listFriends(auth, 'user-alice');
    expect(aliceFriends.map((f) => f.userId)).toContain('user-bob');
    expect(await friends.countFriends('user-alice')).toBe(1);
    expect(await friends.countFriends('user-bob')).toBe(1);
  });

  it('removes a friendship', async () => {
    const req = await friends.sendRequest('user-alice', 'user-bob');
    await friends.respondRequest('user-bob', req.id, true);

    const removed = await friends.removeFriend('user-alice', 'user-bob');
    expect(removed.ok).toBe(true);

    expect(await friends.listFriends(auth, 'user-alice')).toEqual([]);
    expect(await friends.listFriends(auth, 'user-bob')).toEqual([]);

    const missing = await friends.removeFriend('user-alice', 'user-bob');
    expect(missing.ok).toBe(false);
  });

  it('purges friendships, requests, groups, and challenges for a deleted user', async () => {
    const req = await friends.sendRequest('user-alice', 'user-bob');
    await friends.respondRequest('user-bob', req.id, true);
    const reqCarol = await friends.sendRequest('user-alice', 'user-carol');
    await friends.respondRequest('user-carol', reqCarol.id, true);
    await friends.createGroup(auth, 'user-alice', 'Crew', ['user-bob']);
    await friends.createChallenge('user-alice', 'user-bob', 'table-1', '1111');
    await friends.sendRequest('user-bob', 'user-carol');

    const friendIds = await friends.purgeUser('user-alice');
    expect(friendIds.sort()).toEqual(['user-bob', 'user-carol']);
    expect(await friends.listFriends(auth, 'user-bob')).toEqual([]);
    expect(await friends.listFriends(auth, 'user-carol')).toEqual([]);
    expect(await friends.listIncomingRequests(auth, 'user-carol')).toHaveLength(1);
    expect(await friends.listGroups(auth, 'user-bob')).toEqual([]);
    expect(await friends.listPendingChallenges(auth, 'user-bob')).toHaveLength(0);
  });

  it('creates challenges only between friends', async () => {
    const req = await friends.sendRequest('user-alice', 'user-bob');
    await friends.respondRequest('user-bob', req.id, true);

    await expect(
      friends.createChallenge('user-alice', 'user-carol', 'table-1', 'invite-1'),
    ).rejects.toThrow('Can only challenge friends');

    const challenge = await friends.createChallenge(
      'user-alice',
      'user-bob',
      'table-1',
      'invite-1',
    );
    expect(challenge.tableId).toBe('table-1');

    const pending = await friends.listPendingChallenges(auth, 'user-bob');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.challenger.name).toBe('Alice');

    const declined = await friends.declineChallenge(challenge.id, 'user-bob');
    expect(declined.ok).toBe(true);
    expect(await friends.listPendingChallenges(auth, 'user-bob')).toHaveLength(0);
  });

  it('finds users by exact username only', () => {
    expect(friends.searchUsers(auth, 'ali', 'user-bob')).toEqual([]);
    expect(friends.searchUsers(auth, 'Alice', 'user-bob').map((u) => u.id)).toEqual([
      'user-alice',
    ]);
    expect(friends.searchUsers(auth, 'alice', 'user-bob').map((u) => u.id)).toEqual([
      'user-alice',
    ]);
    expect(friends.searchUsers(auth, 'Alice', 'user-alice')).toEqual([]);
  });

  it('creates friend groups and group game invites', async () => {
    const req = await friends.sendRequest('user-alice', 'user-bob');
    await friends.respondRequest('user-bob', req.id, true);
    const req2 = await friends.sendRequest('user-alice', 'user-carol');
    await friends.respondRequest('user-carol', req2.id, true);

    const group = await friends.createGroup(auth, 'user-alice', 'Crew', [
      'user-bob',
      'user-carol',
    ]);
    expect(group.members.map((m) => m.userId)).toEqual([
      'user-alice',
      'user-bob',
      'user-carol',
    ]);

    const challenges = await friends.createGroupGameInvites(
      'user-alice',
      await friends.requireGroup(group.id),
      ['user-bob', 'user-carol'],
      'table-group-1',
      '1234',
    );
    expect(challenges).toHaveLength(2);

    const bobPending = await friends.listPendingChallenges(auth, 'user-bob');
    expect(bobPending).toHaveLength(1);
    expect(bobPending[0]!.groupName).toBe('Crew');
    expect(bobPending[0]!.inviteCode).toBe('1234');
    expect(bobPending[0]!.kind).toBe('table');
  });

  it('invites friends to a contest', async () => {
    const req = await friends.sendRequest('user-alice', 'user-bob');
    await friends.respondRequest('user-bob', req.id, true);

    const challenges = await friends.createFriendInvites(
      'user-alice',
      ['user-bob', 'user-carol'],
      { kind: 'contest', contestId: 'contest-1', inviteCode: '5555' },
    );
    // Carol is not a friend — only Bob
    expect(challenges).toHaveLength(1);
    expect(challenges[0]!.kind).toBe('contest');
    expect(challenges[0]!.contestId).toBe('contest-1');

    const pending = await friends.listPendingChallenges(auth, 'user-bob');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.kind).toBe('contest');
    expect(pending[0]!.contestId).toBe('contest-1');
    expect(pending[0]!.tableId).toBeNull();
  });

  it('invites friends to a ludo board', async () => {
    const req = await friends.sendRequest('user-alice', 'user-bob');
    await friends.respondRequest('user-bob', req.id, true);

    const challenges = await friends.createFriendInvites(
      'user-alice',
      ['user-bob'],
      { kind: 'ludo', ludoId: 'ludo-1', inviteCode: '4242' },
    );
    expect(challenges).toHaveLength(1);
    expect(challenges[0]!.kind).toBe('ludo');
    expect(challenges[0]!.ludoId).toBe('ludo-1');

    const pending = await friends.listPendingChallenges(auth, 'user-bob');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.kind).toBe('ludo');
    expect(pending[0]!.ludoId).toBe('ludo-1');
    expect(pending[0]!.tableId).toBeNull();
    expect(pending[0]!.contestId).toBeNull();
    expect(pending[0]!.inviteCode).toBe('4242');
  });

  it('expires game invites after 2 minutes', async () => {
    vi.useFakeTimers();
    try {
      const req = await friends.sendRequest('user-alice', 'user-bob');
      await friends.respondRequest('user-bob', req.id, true);

      const challenge = await friends.createChallenge(
        'user-alice',
        'user-bob',
        'table-ttl',
        '9999',
      );
      expect(await friends.listPendingChallenges(auth, 'user-bob')).toHaveLength(1);

      vi.advanceTimersByTime(CHALLENGE_TTL_MS - 1);
      expect(await friends.listPendingChallenges(auth, 'user-bob')).toHaveLength(1);

      vi.advanceTimersByTime(2);
      expect(await friends.listPendingChallenges(auth, 'user-bob')).toHaveLength(0);

      await friends.markChallengeJoined(challenge.id, 'user-bob');
      expect(await friends.listPendingChallenges(auth, 'user-bob')).toHaveLength(0);
      const joinExpired = await friends.markChallengeJoined(challenge.id, 'user-bob');
      expect(joinExpired.ok).toBe(false);
      const declined = await friends.declineChallenge(challenge.id, 'user-bob');
      expect(declined.ok).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
