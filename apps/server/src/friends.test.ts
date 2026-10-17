import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from './auth/auth.store.js';
import {
  CHALLENGE_TTL_MS,
  EMAIL_INVITE_DAILY_CAP,
  EMAIL_INVITE_WINDOW_MS,
  FriendsStore,
} from './friends/friends.store.js';

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

  it('lists and cancels outgoing friend requests', async () => {
    const req = await friends.sendRequest('user-alice', 'user-bob');
    const outgoing = await friends.listOutgoingRequests(auth, 'user-alice');
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0]!.to.name).toBe('Bob');
    expect(await friends.listIncomingRequests(auth, 'user-bob')).toHaveLength(1);

    const cancelled = await friends.cancelRequest('user-alice', req.id);
    expect(cancelled.ok).toBe(true);
    expect(await friends.listOutgoingRequests(auth, 'user-alice')).toHaveLength(0);
    expect(await friends.listIncomingRequests(auth, 'user-bob')).toHaveLength(0);

    const again = await friends.cancelRequest('user-alice', req.id);
    expect(again.ok).toBe(false);

    // Recipient cannot cancel
    const req2 = await friends.sendRequest('user-alice', 'user-bob');
    const asRecipient = await friends.cancelRequest('user-bob', req2.id);
    expect(asRecipient.ok).toBe(false);
  });

  it('lists and cancels outgoing challenges', async () => {
    const req = await friends.sendRequest('user-alice', 'user-bob');
    await friends.respondRequest('user-bob', req.id, true);
    const challenge = await friends.createChallenge(
      'user-alice',
      'user-bob',
      'table-1',
      'invite-1',
    );

    const outgoing = await friends.listOutgoingChallenges(auth, 'user-alice');
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0]!.challenged.name).toBe('Bob');
    expect(await friends.listPendingChallenges(auth, 'user-bob')).toHaveLength(1);

    const cancelled = await friends.cancelChallenge(challenge.id, 'user-alice');
    expect(cancelled.ok).toBe(true);
    expect(await friends.listOutgoingChallenges(auth, 'user-alice')).toHaveLength(0);
    expect(await friends.listPendingChallenges(auth, 'user-bob')).toHaveLength(0);

    const asChallenged = await friends.cancelChallenge(challenge.id, 'user-bob');
    expect(asChallenged.ok).toBe(false);
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

  async function befriend(a: string, b: string) {
    const req = await friends.sendRequest(a, b);
    await friends.respondRequest(b, req.id, true);
  }

  it('suggests friends of friends with the mutual friends they share', async () => {
    await auth.seedUser('user-dave', 'Dave', 'password1', 3);
    await befriend('user-alice', 'user-bob');
    await befriend('user-bob', 'user-carol');
    await befriend('user-alice', 'user-dave');
    await befriend('user-dave', 'user-carol');

    const mutual = await friends.mutualFriendCandidates('user-alice');
    expect(mutual.get('user-carol')?.sort()).toEqual(['user-bob', 'user-dave']);
    expect(mutual.has('user-alice')).toBe(false);
  });

  it('excludes self, friends, pending requests, and dismissed users from suggestions', async () => {
    await auth.seedUser('user-dave', 'Dave', 'password1', 3);
    await auth.seedUser('user-erin', 'Erin', 'password1', 4);
    await befriend('user-alice', 'user-bob');
    await friends.sendRequest('user-alice', 'user-carol');
    await friends.sendRequest('user-dave', 'user-alice');
    await friends.dismissSuggestion('user-alice', 'user-erin');

    const exclude = await friends.suggestionExclusions('user-alice');
    expect([...exclude].sort()).toEqual([
      'user-alice',
      'user-bob',
      'user-carol',
      'user-dave',
      'user-erin',
    ]);
    expect((await friends.suggestionExclusions('user-bob')).has('user-erin')).toBe(false);
  });

  it('keeps dismissed suggestions across a reload', async () => {
    await friends.dismissSuggestion('user-alice', 'user-carol');
    await friends.dismissSuggestion('user-alice', 'user-carol');
    const reloaded = new FriendsStore(dir);
    const exclude = await reloaded.suggestionExclusions('user-alice');
    expect(exclude.has('user-carol')).toBe(true);
  });

  it('drops a purged user from dismissed suggestion lists', async () => {
    await friends.dismissSuggestion('user-alice', 'user-carol');
    await friends.dismissSuggestion('user-carol', 'user-bob');
    await friends.purgeUser('user-carol');
    expect((await friends.suggestionExclusions('user-alice')).has('user-carol')).toBe(false);
    const reloaded = new FriendsStore(dir);
    expect((await reloaded.suggestionExclusions('user-carol')).has('user-bob')).toBe(false);
  });

  it('keeps one stable friend link code per user', async () => {
    const code = await friends.getOrCreateFriendLink('user-alice');
    expect(code).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(await friends.getOrCreateFriendLink('user-alice')).toBe(code);
    expect(await new FriendsStore(dir).getOrCreateFriendLink('user-alice')).toBe(code);
    expect(await friends.getOrCreateFriendLink('user-bob')).not.toBe(code);
    expect(await friends.resolveFriendLink(code)).toBe('user-alice');
    expect(await friends.resolveFriendLink('nope')).toBeNull();
  });

  it('befriends anyone who accepts a friend link', async () => {
    const code = await friends.getOrCreateFriendLink('user-alice');
    const res = await friends.redeemFriendLink('user-bob', code);
    expect(res).toEqual({ ok: true, ownerId: 'user-alice', result: 'friends' });
    expect((await friends.listFriends(auth, 'user-alice')).map((f) => f.userId)).toEqual([
      'user-bob',
    ]);
    const again = await friends.redeemFriendLink('user-bob', code);
    expect(again).toEqual({ ok: true, ownerId: 'user-alice', result: 'already_friends' });
  });

  it('closes pending requests in either direction when a link is accepted', async () => {
    await friends.sendRequest('user-alice', 'user-bob');
    await friends.sendRequest('user-carol', 'user-alice');
    const code = await friends.getOrCreateFriendLink('user-alice');

    expect((await friends.redeemFriendLink('user-bob', code)).ok).toBe(true);
    expect(await friends.listIncomingRequests(auth, 'user-bob')).toHaveLength(0);

    expect((await friends.redeemFriendLink('user-carol', code)).ok).toBe(true);
    expect(await friends.listIncomingRequests(auth, 'user-alice')).toHaveLength(0);
    expect(await friends.countFriends('user-alice')).toBe(2);
  });

  it('rejects redeeming your own or an unknown link', async () => {
    const code = await friends.getOrCreateFriendLink('user-alice');
    expect(await friends.redeemFriendLink('user-alice', code)).toEqual({
      ok: false,
      error: 'This is your own link',
    });
    expect((await friends.redeemFriendLink('user-bob', 'missing1')).ok).toBe(false);
  });

  it('requestFriendship covers new, reciprocal, pending, friends, and self', async () => {
    expect(await friends.requestFriendship('user-alice', 'user-bob')).toBe('requested');
    expect(await friends.requestFriendship('user-alice', 'user-bob')).toBe('pending');
    expect(await friends.countFriends('user-alice')).toBe(0);

    expect(await friends.requestFriendship('user-bob', 'user-alice')).toBe('accepted');
    expect(await friends.countFriends('user-alice')).toBe(1);
    expect(await friends.listIncomingRequests(auth, 'user-bob')).toHaveLength(0);

    expect(await friends.requestFriendship('user-alice', 'user-bob')).toBe('already_friends');
    await expect(friends.requestFriendship('user-carol', 'user-carol')).rejects.toThrow(
      'Cannot add yourself',
    );
  });

  it('dedupes email invites for 24 hours and caps them per day', async () => {
    const t0 = 1_000_000;
    expect(await friends.recordEmailInvites('user-alice', ['a@x.com', 'b@x.com'], t0)).toEqual([
      'a@x.com',
      'b@x.com',
    ]);
    expect(await friends.recordEmailInvites('user-alice', ['a@x.com', 'c@x.com'], t0 + 1)).toEqual(
      ['c@x.com'],
    );
    expect(
      await friends.recordEmailInvites('user-alice', ['a@x.com'], t0 + EMAIL_INVITE_WINDOW_MS + 1),
    ).toEqual(['a@x.com']);

    const many = Array.from({ length: EMAIL_INVITE_DAILY_CAP + 5 }, (_, i) => `p${i}@x.com`);
    const allowed = await friends.recordEmailInvites('user-bob', many, t0);
    expect(allowed).toHaveLength(EMAIL_INVITE_DAILY_CAP);
    expect(await friends.recordEmailInvites('user-bob', ['late@x.com'], t0 + 1)).toEqual([]);
  });

  it('drops friend link and email log for a purged user', async () => {
    const code = await friends.getOrCreateFriendLink('user-alice');
    await friends.recordEmailInvites('user-alice', ['a@x.com'], 1);
    await friends.purgeUser('user-alice');
    expect(await friends.resolveFriendLink(code)).toBeNull();
    expect(await friends.recordEmailInvites('user-alice', ['a@x.com'], 2)).toEqual(['a@x.com']);
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
