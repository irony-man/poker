import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from './auth.js';
import { FriendsStore } from './friends.js';

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
  });

  it('searches users by name', () => {
    const results = friends.searchUsers(auth, 'ali', 'user-bob');
    expect(results.map((u) => u.id)).toEqual(['user-alice']);
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
  });
});
