import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ChallengeFriendBodySchema,
  CreateFriendGroupBodySchema,
  FriendRequestBodySchema,
  FriendRespondBodySchema,
  InviteFriendGroupBodySchema,
  UpdateFriendGroupBodySchema,
} from '@poker/protocol';
import { AuthService } from '../auth/auth.service.js';
import type { User } from '../auth/auth.types.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { FriendsService } from './friends.service.js';

@Controller('api/friends')
@UseGuards(SessionAuthGuard)
export class FriendsController {
  constructor(
    private readonly friends: FriendsService,
    private readonly auth: AuthService,
    private readonly rooms: RoomsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: User) {
    try {
      const [friendList, incoming, pendingChallenges, groups] = await Promise.all([
        this.friends.listFriends(user.id),
        this.friends.listIncomingRequests(user.id),
        this.friends.listPendingChallenges(user.id),
        this.friends.listGroups(user.id),
      ]);
      return { friends: friendList, incoming, pendingChallenges, groups };
    } catch (err) {
      throw new BadRequestException({
        error: err instanceof Error ? err.message : 'Failed',
      });
    }
  }

  @Get('search')
  search(@CurrentUser() user: User, @Query('q') q?: string) {
    const users = this.friends.searchUsers(String(q ?? ''), user.id).map((u) => ({
      userId: u.id,
      name: u.username || u.name,
      username: u.username,
      avatarId: u.avatarId,
    }));
    return { users };
  }

  @Post('requests')
  async sendRequest(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = FriendRequestBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    if (!this.auth.getUser(parsed.data.targetUserId)) {
      throw new NotFoundException({ error: 'Player not found' });
    }
    try {
      const request = await this.friends.sendRequest(user.id, parsed.data.targetUserId);
      return { request };
    } catch (err) {
      throw new BadRequestException({
        error: err instanceof Error ? err.message : 'Failed',
      });
    }
  }

  @Post('requests/:id/respond')
  async respond(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = FriendRespondBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const result = await this.friends.respondRequest(user.id, id, parsed.data.accept);
    if (!result.ok) {
      throw new NotFoundException({ error: result.error });
    }
    return { ok: true };
  }

  @Post('challenge')
  async challenge(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = ChallengeFriendBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const challenger = this.auth.getUser(user.id);
    const opponent = this.auth.getUser(parsed.data.friendUserId);
    if (!challenger || !opponent) {
      throw new NotFoundException({ error: 'Player not found' });
    }
    try {
      const meta = this.rooms.create({
        name: `${challenger.name} vs ${opponent.name}`,
        hostUserId: challenger.id,
        isPrivate: true,
        config: {
          maxSeats: 2,
          smallBlind: 5,
          bigBlind: 10,
          buyIn: 1000,
          turnTimeMs: 20000,
        },
      });
      const challenge = await this.friends.createChallenge(
        user.id,
        parsed.data.friendUserId,
        meta.id,
        meta.inviteCode,
      );
      return {
        tableId: meta.id,
        inviteCode: meta.inviteCode,
        challengeId: challenge.id,
      };
    } catch (err) {
      throw new BadRequestException({
        error: err instanceof Error ? err.message : 'Challenge failed',
      });
    }
  }

  @Post('challenges/:id/join')
  async joinChallenge(@CurrentUser() user: User, @Param('id') id: string) {
    await this.friends.markChallengeJoined(id, user.id);
    return { ok: true };
  }

  @Post('challenges/:id/decline')
  async declineChallenge(@CurrentUser() user: User, @Param('id') id: string) {
    const result = await this.friends.declineChallenge(id, user.id);
    if (!result.ok) {
      throw new NotFoundException({ error: result.error });
    }
    return { ok: true };
  }

  @Post('groups')
  async createGroup(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = CreateFriendGroupBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    try {
      const group = await this.friends.createGroup(
        user.id,
        parsed.data.name,
        parsed.data.memberUserIds,
      );
      return { group };
    } catch (err) {
      throw new BadRequestException({
        error: err instanceof Error ? err.message : 'Failed',
      });
    }
  }

  @Patch('groups/:id')
  async updateGroup(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateFriendGroupBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    try {
      const group = await this.friends.updateGroup(user.id, id, parsed.data);
      return { group };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed';
      if (message === 'Group not found') {
        throw new NotFoundException({ error: message });
      }
      throw new BadRequestException({ error: message });
    }
  }

  @Delete('groups/:id')
  async deleteGroup(@CurrentUser() user: User, @Param('id') id: string) {
    try {
      await this.friends.deleteGroup(user.id, id);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed';
      if (message === 'Group not found') {
        throw new NotFoundException({ error: message });
      }
      throw new BadRequestException({ error: message });
    }
  }

  @Post('groups/:id/invite')
  async inviteGroup(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = InviteFriendGroupBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    try {
      const group = await this.friends.requireGroup(id);
      const isInGroup =
        group.ownerUserId === user.id || group.memberUserIds.includes(user.id);
      if (!isInGroup) {
        throw new ForbiddenException({ error: 'You are not in this group' });
      }

      const defaultInvitees = [group.ownerUserId, ...group.memberUserIds].filter(
        (mid) => mid !== user.id,
      );
      const inviteeIds = parsed.data.memberUserIds?.length
        ? parsed.data.memberUserIds
        : defaultInvitees;

      const seatsNeeded = Math.min(9, Math.max(2, inviteeIds.length + 1));
      const maxSeats = parsed.data.maxSeats ?? seatsNeeded;
      const smallBlind = parsed.data.smallBlind ?? 5;
      const bigBlind = parsed.data.bigBlind ?? 10;
      const buyIn = parsed.data.buyIn ?? 1000;

      const meta = this.rooms.create({
        name: `${group.name}`,
        hostUserId: user.id,
        isPrivate: true,
        config: {
          maxSeats,
          smallBlind,
          bigBlind,
          buyIn,
          turnTimeMs: 20000,
        },
      });

      const challenges = await this.friends.createGroupGameInvites(
        user.id,
        group,
        inviteeIds,
        meta.id,
        meta.inviteCode,
      );

      return {
        tableId: meta.id,
        inviteCode: meta.inviteCode,
        inviteCount: challenges.length,
        challengeIds: challenges.map((c) => c.id),
      };
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      const message = err instanceof Error ? err.message : 'Invite failed';
      if (message === 'Group not found') {
        throw new NotFoundException({ error: message });
      }
      throw new BadRequestException({ error: message });
    }
  }
}
