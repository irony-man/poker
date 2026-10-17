import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service.js';
import type { AuthStore } from '../auth/auth.store.js';
import type { User } from '../auth/auth.types.js';
import { dataSourceAsQueryable } from '../database/queryable.js';
import { MailService } from '../mail/mail.service.js';
import { playerUserIdsFromResultJson } from '../history/history.store.js';
import { HistoryService } from '../history/history.service.js';
import { PresenceService } from '../presence/presence.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { normalizeInviteEmails, splitInviteTargets } from './email-invites.js';
import { FriendsStore, type FriendProfile } from './friends.store.js';
import { rankSuggestions, type SuggestionReason } from './suggestions.js';

/** Recent hands scanned for "played together" suggestions. */
const SUGGESTION_HAND_SCAN = 200;
export interface EmailInviteOutcome {
  /** New friend requests sent to existing players. */
  requested: number;
  /** They had already asked you, so you are now friends. */
  accepted: number;
  /** Already friends, or your request was already pending. */
  alreadyConnected: number;
  /** Invite emails sent to addresses with no account. */
  emailed: number;
  /** Blocked by the 24h dedupe or daily cap, or failed to send. */
  skipped: number;
}

export interface FriendSuggestionView extends FriendProfile {
  online: boolean;
  mutualCount: number;
  mutualNames: string[];
  handsTogether: number;
  reason: SuggestionReason;
}

@Injectable()
export class FriendsService implements OnModuleInit {
  private store!: FriendsStore;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly presence: PresenceService,
    private readonly realtime: RealtimeService,
    private readonly history: HistoryService,
    private readonly mail: MailService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    const dataDir = this.config.get<string>('DATA_DIR') ?? `${process.cwd()}/data`;
    this.store = new FriendsStore(dataDir, dataSourceAsQueryable(this.dataSource));
  }

  onModuleInit(): void {
    this.realtime.setSocialLoader(async (userId) => this.buildSocialSync(userId));
    this.realtime.setFriendIdsLoader(async (userId) => {
      const list = await this.store.listFriends(this.authStore(), userId);
      return list.map((p) => p.userId);
    });
  }

  private authStore(): AuthStore {
    return this.auth.asStore();
  }

  asStore(): FriendsStore {
    return this.store;
  }

  async buildSocialSync(userId: string) {
    const [friends, incoming, outgoing, pendingChallenges, outgoingChallenges, groups] =
      await Promise.all([
        this.listFriends(userId),
        this.listIncomingRequests(userId),
        this.listOutgoingRequests(userId),
        this.listPendingChallenges(userId),
        this.listOutgoingChallenges(userId),
        this.listGroups(userId),
      ]);
    return {
      type: 'social_sync' as const,
      friends,
      incoming,
      outgoing,
      pendingChallenges,
      outgoingChallenges,
      groups,
    };
  }

  private async notifyUsers(...userIds: Array<string | null | undefined>): Promise<void> {
    const unique = new Set(userIds.filter((id): id is string => Boolean(id)));
    await Promise.all([...unique].map((id) => this.realtime.pushSocial(id)));
  }

  countFriends(userId: string): Promise<number> {
    return this.store.countFriends(userId);
  }

  getRelationship(viewerId: string, targetId: string) {
    return this.store.getRelationship(viewerId, targetId);
  }

  async listFriends(userId: string) {
    const list = await this.store.listFriends(this.authStore(), userId);
    return list.map((p) => ({
      ...p,
      online: this.presence.isOnline(p.userId),
    }));
  }

  listIncomingRequests(userId: string) {
    return this.store.listIncomingRequests(this.authStore(), userId);
  }

  listOutgoingRequests(userId: string) {
    return this.store.listOutgoingRequests(this.authStore(), userId);
  }

  listPendingChallenges(userId: string) {
    return this.store.listPendingChallenges(this.authStore(), userId);
  }

  listOutgoingChallenges(userId: string) {
    return this.store.listOutgoingChallenges(this.authStore(), userId);
  }

  listGroups(userId: string) {
    return this.store.listGroups(this.authStore(), userId);
  }

  searchUsers(query: string, excludeUserId: string) {
    return this.store.searchUsers(this.authStore(), query, excludeUserId);
  }

  private async handsTogetherCounts(userId: string): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    const hands = await this.history.listHandsForUser(userId, SUGGESTION_HAND_SCAN);
    for (const hand of hands) {
      for (const id of playerUserIdsFromResultJson(hand.resultJson)) {
        if (id === userId) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }

  async listSuggestions(userId: string): Promise<FriendSuggestionView[]> {
    const [mutual, exclude, handsTogether] = await Promise.all([
      this.store.mutualFriendCandidates(userId),
      this.store.suggestionExclusions(userId),
      this.handsTogetherCounts(userId).catch(() => new Map<string, number>()),
    ]);
    const auth = this.authStore();
    for (const id of new Set([...mutual.keys(), ...handsTogether.keys()])) {
      if (!auth.getUser(id)) exclude.add(id);
    }
    const ranked = rankSuggestions({
      mutual,
      handsTogether,
      exclude,
      nameOf: (id) => auth.getUser(id)?.name ?? id,
    });
    const out: FriendSuggestionView[] = [];
    for (const s of ranked) {
      const user = auth.getUser(s.userId);
      if (!user) continue;
      const mutualNames = s.mutualFriendIds
        .map((id) => auth.getUser(id)?.name)
        .filter((n): n is string => Boolean(n))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 2);
      out.push({
        userId: user.id,
        name: user.name,
        username: user.username,
        avatarId: user.avatarId,
        avatarUrl: user.avatarUrl,
        online: this.presence.isOnline(user.id),
        mutualCount: s.mutualFriendIds.length,
        mutualNames,
        handsTogether: s.handsTogether,
        reason: s.reason,
      });
    }
    return out;
  }

  dismissSuggestion(userId: string, targetUserId: string) {
    return this.store.dismissSuggestion(userId, targetUserId);
  }

  async friendLink(userId: string): Promise<{ code: string; url: string }> {
    const code = await this.store.getOrCreateFriendLink(userId);
    return { code, url: this.mail.webLink(`/f/${code}`) };
  }

  /** Public owner card for the `/f/:code` landing page. */
  async friendLinkOwner(code: string) {
    const ownerId = await this.store.resolveFriendLink(code);
    const owner = ownerId ? this.auth.getUser(ownerId) : null;
    if (!owner) return null;
    return {
      userId: owner.id,
      username: owner.username,
      name: owner.name,
      avatarId: owner.avatarId,
      avatarUrl: owner.avatarUrl,
    };
  }

  async redeemFriendLink(visitor: User, code: string) {
    const result = await this.store.redeemFriendLink(visitor.id, code);
    if (result.ok && result.result === 'friends') {
      await this.notifyUsers(result.ownerId, visitor.id);
    }
    return result;
  }

  /**
   * Verified emails of existing players get an in-app friend request. Every
   * other address gets the invite email. All addresses count toward the daily cap.
   */
  async sendEmailInvites(user: User, emails: string[]): Promise<EmailInviteOutcome> {
    const normalized = normalizeInviteEmails(emails, user.email);
    const allowed = await this.store.recordEmailInvites(user.id, normalized);
    const auth = this.authStore();
    const { users, unknown } = splitInviteTargets(
      allowed,
      (email) => auth.getUserByVerifiedEmail(email)?.id,
    );

    const outcome: EmailInviteOutcome = {
      requested: 0,
      accepted: 0,
      alreadyConnected: 0,
      emailed: 0,
      skipped: 0,
    };
    const notified: string[] = [];
    for (const { userId } of users) {
      if (userId === user.id) continue;
      try {
        const result = await this.store.requestFriendship(user.id, userId);
        if (result === 'requested') outcome.requested += 1;
        else if (result === 'accepted') outcome.accepted += 1;
        else outcome.alreadyConnected += 1;
        if (result === 'requested' || result === 'accepted') notified.push(userId);
      } catch (err) {
        console.error('[friends] invite friend request failed', err);
      }
    }
    if (notified.length > 0) await this.notifyUsers(user.id, ...notified);

    if (unknown.length > 0) {
      const { url } = await this.friendLink(user.id);
      for (const to of unknown) {
        try {
          await this.mail.sendFriendInvite(to, user.name, url);
          outcome.emailed += 1;
        } catch (err) {
          console.error('[friends] invite email failed', err);
        }
      }
    }

    outcome.skipped =
      normalized.length -
      outcome.requested -
      outcome.accepted -
      outcome.alreadyConnected -
      outcome.emailed;
    return outcome;
  }

  async sendRequest(fromUserId: string, toUserId: string) {
    const request = await this.store.sendRequest(fromUserId, toUserId);
    await this.notifyUsers(fromUserId, toUserId);
    return request;
  }

  async respondRequest(userId: string, requestId: string, accept: boolean) {
    const result = await this.store.respondRequest(userId, requestId, accept);
    if (result.ok) {
      await this.notifyUsers(result.fromUserId, result.toUserId);
    }
    return result;
  }

  async cancelRequest(userId: string, requestId: string) {
    const result = await this.store.cancelRequest(userId, requestId);
    if (result.ok) {
      await this.notifyUsers(result.fromUserId, result.toUserId);
    }
    return result;
  }

  async removeFriend(userId: string, friendUserId: string) {
    const result = await this.store.removeFriend(userId, friendUserId);
    if (result.ok) {
      await this.notifyUsers(userId, friendUserId);
    }
    return result;
  }

  async purgeUser(userId: string) {
    const friendIds = await this.store.purgeUser(userId);
    await this.notifyUsers(...friendIds);
    return friendIds;
  }

  async createChallenge(
    challengerId: string,
    challengedId: string,
    tableId: string,
    inviteCode: string,
    extra?: { groupId?: string; groupName?: string },
  ) {
    const challenge = await this.store.createChallenge(
      challengerId,
      challengedId,
      tableId,
      inviteCode,
      extra,
    );
    await this.notifyUsers(challengerId, challengedId);
    return challenge;
  }

  async createFriendInvites(
    hostUserId: string,
    friendUserIds: string[],
    target:
      | { kind: 'table'; tableId: string; inviteCode: string }
      | { kind: 'contest'; contestId: string; inviteCode: string }
      | { kind: 'ludo'; ludoId: string; inviteCode: string }
      | { kind: 'snakes'; snakesId: string; inviteCode: string }
      | { kind: 'memory'; memoryId: string; inviteCode: string }
      | { kind: 'courtpiece'; courtpieceId: string; inviteCode: string },
  ) {
    const result = await this.store.createFriendInvites(hostUserId, friendUserIds, target);
    await this.notifyUsers(hostUserId, ...friendUserIds);
    return result;
  }

  async markChallengeJoined(challengeId: string, userId: string) {
    const result = await this.store.markChallengeJoined(challengeId, userId);
    if (result.ok) {
      await this.notifyUsers(userId);
    }
    return result;
  }

  async declineChallenge(challengeId: string, userId: string) {
    const result = await this.store.declineChallenge(challengeId, userId);
    if (result.ok) {
      await this.notifyUsers(userId);
    }
    return result;
  }

  async cancelChallenge(challengeId: string, userId: string) {
    const result = await this.store.cancelChallenge(challengeId, userId);
    if (result.ok) {
      await this.notifyUsers(result.challengerId, result.challengedId);
    }
    return result;
  }

  async createGroup(ownerUserId: string, name: string, memberUserIds: string[]) {
    const group = await this.store.createGroup(this.authStore(), ownerUserId, name, memberUserIds);
    await this.notifyUsers(ownerUserId, ...memberUserIds);
    return group;
  }

  async updateGroup(
    userId: string,
    groupId: string,
    patch: { name?: string; memberUserIds?: string[] },
  ) {
    const before = await this.store.requireGroup(groupId);
    const group = await this.store.updateGroup(this.authStore(), userId, groupId, patch);
    const oldMembers = [before.ownerUserId, ...before.memberUserIds];
    const newMembers = [group.ownerUserId, ...group.members.map((m) => m.userId)];
    await this.notifyUsers(...oldMembers, ...newMembers);
    return group;
  }

  async deleteGroup(userId: string, groupId: string) {
    const before = await this.store.requireGroup(groupId);
    await this.store.deleteGroup(userId, groupId);
    await this.notifyUsers(before.ownerUserId, ...before.memberUserIds);
  }

  requireGroup(groupId: string) {
    return this.store.requireGroup(groupId);
  }

  async createGroupGameInvites(
    hostUserId: string,
    group: import('./friends.store.js').FriendGroup,
    inviteeIds: string[],
    tableId: string,
    inviteCode: string,
  ) {
    const challenges = await this.store.createGroupGameInvites(
      hostUserId,
      group,
      inviteeIds,
      tableId,
      inviteCode,
    );
    await this.notifyUsers(hostUserId, ...inviteeIds);
    return challenges;
  }
}
