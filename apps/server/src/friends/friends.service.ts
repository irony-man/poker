import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service.js';
import type { AuthStore } from '../auth/auth.store.js';
import { dataSourceAsQueryable } from '../database/queryable.js';
import { PresenceService } from '../presence/presence.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { FriendsStore } from './friends.store.js';

@Injectable()
export class FriendsService implements OnModuleInit {
  private store!: FriendsStore;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly presence: PresenceService,
    private readonly realtime: RealtimeService,
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
    const [friends, incoming, pendingChallenges, groups] = await Promise.all([
      this.listFriends(userId),
      this.listIncomingRequests(userId),
      this.listPendingChallenges(userId),
      this.listGroups(userId),
    ]);
    return {
      type: 'social_sync' as const,
      friends,
      incoming,
      pendingChallenges,
      groups,
    };
  }

  private async notifyUsers(...userIds: Array<string | null | undefined>): Promise<void> {
    const unique = new Set(userIds.filter((id): id is string => Boolean(id)));
    await Promise.all([...unique].map((id) => this.realtime.pushSocial(id)));
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

  listPendingChallenges(userId: string) {
    return this.store.listPendingChallenges(this.authStore(), userId);
  }

  listGroups(userId: string) {
    return this.store.listGroups(this.authStore(), userId);
  }

  searchUsers(query: string, excludeUserId: string) {
    return this.store.searchUsers(this.authStore(), query, excludeUserId);
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

  async removeFriend(userId: string, friendUserId: string) {
    const result = await this.store.removeFriend(userId, friendUserId);
    if (result.ok) {
      await this.notifyUsers(userId, friendUserId);
    }
    return result;
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
      | { kind: 'contest'; contestId: string; inviteCode: string },
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
