import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service.js';
import type { AuthStore } from '../auth/auth.store.js';
import { dataSourceAsQueryable } from '../database/queryable.js';
import { PresenceService } from '../presence/presence.service.js';
import { FriendsStore } from './friends.store.js';

@Injectable()
export class FriendsService implements OnModuleInit {
  private store!: FriendsStore;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly presence: PresenceService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    const dataDir = this.config.get<string>('DATA_DIR') ?? `${process.cwd()}/data`;
    this.store = new FriendsStore(dataDir, dataSourceAsQueryable(this.dataSource));
  }

  // Ensure social graph loads on first use via ensureLoaded; warm nothing beyond ctor.
  onModuleInit(): void {
    /* pool already attached */
  }

  private authStore(): AuthStore {
    return this.auth.asStore();
  }

  asStore(): FriendsStore {
    return this.store;
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

  sendRequest(fromUserId: string, toUserId: string) {
    return this.store.sendRequest(fromUserId, toUserId);
  }

  respondRequest(userId: string, requestId: string, accept: boolean) {
    return this.store.respondRequest(userId, requestId, accept);
  }

  removeFriend(userId: string, friendUserId: string) {
    return this.store.removeFriend(userId, friendUserId);
  }

  createChallenge(
    challengerId: string,
    challengedId: string,
    tableId: string,
    inviteCode: string,
    extra?: { groupId?: string; groupName?: string },
  ) {
    return this.store.createChallenge(challengerId, challengedId, tableId, inviteCode, extra);
  }

  createFriendInvites(
    hostUserId: string,
    friendUserIds: string[],
    target:
      | { kind: 'table'; tableId: string; inviteCode: string }
      | { kind: 'contest'; contestId: string; inviteCode: string },
  ) {
    return this.store.createFriendInvites(hostUserId, friendUserIds, target);
  }

  markChallengeJoined(challengeId: string, userId: string) {
    return this.store.markChallengeJoined(challengeId, userId);
  }

  declineChallenge(challengeId: string, userId: string) {
    return this.store.declineChallenge(challengeId, userId);
  }

  createGroup(ownerUserId: string, name: string, memberUserIds: string[]) {
    return this.store.createGroup(this.authStore(), ownerUserId, name, memberUserIds);
  }

  updateGroup(
    userId: string,
    groupId: string,
    patch: { name?: string; memberUserIds?: string[] },
  ) {
    return this.store.updateGroup(this.authStore(), userId, groupId, patch);
  }

  deleteGroup(userId: string, groupId: string) {
    return this.store.deleteGroup(userId, groupId);
  }

  requireGroup(groupId: string) {
    return this.store.requireGroup(groupId);
  }

  createGroupGameInvites(
    hostUserId: string,
    group: import('./friends.store.js').FriendGroup,
    inviteeIds: string[],
    tableId: string,
    inviteCode: string,
  ) {
    return this.store.createGroupGameInvites(hostUserId, group, inviteeIds, tableId, inviteCode);
  }
}
