import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateContestBodySchema, InviteFriendsBodySchema } from '@poker/protocol';
import { AuthService } from '../auth/auth.service.js';
import type { User } from '../auth/auth.types.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { FriendsService } from '../friends/friends.service.js';
import { HistoryService, toPublicHandRows } from '../history/history.service.js';
import { ContestsService } from './contests.service.js';

@Controller('api/contests')
export class ContestsController {
  constructor(
    private readonly contests: ContestsService,
    private readonly auth: AuthService,
    private readonly friends: FriendsService,
    private readonly history: HistoryService,
  ) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  async create(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = CreateContestBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    try {
      const d = parsed.data;
      let contest = await this.contests.create({
        name: d.name,
        mode: d.mode,
        hostUserId: user.id,
        hostName: user.name,
        fieldSize: d.fieldSize,
        startingStack: d.startingStack,
        smallBlind: d.smallBlind,
        bigBlind: d.bigBlind,
        turnTimeMs: d.turnTimeMs,
        botCount: d.botCount,
        isPrivate: d.isPrivate,
        inviteCode: d.inviteCode,
        autoStart: d.autoStart,
        handLimit: d.handLimit,
      });

      let inviteCount = 0;
      if (d.inviteFriendIds.length > 0) {
        const invites = await this.friends.createFriendInvites(user.id, d.inviteFriendIds, {
          kind: 'contest',
          contestId: contest.id,
          inviteCode: contest.inviteCode,
        });
        inviteCount = invites.length;
        if (invites.length > 0) {
          const pending = invites.map((ch) => {
            const friend = this.auth.getUser(ch.challengedId);
            return {
              userId: ch.challengedId,
              name: friend?.name ?? 'Friend',
            };
          });
          const updated = this.contests.recordPendingInvites(contest.id, pending);
          if (updated) contest = updated;
        }
      }

      return { contest, inviteCount };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create contest';
      if (message.includes('already in use')) {
        throw new ConflictException({ error: message });
      }
      throw new BadRequestException({ error: message });
    }
  }

  @Post(':id/invite-friends')
  @UseGuards(SessionAuthGuard)
  async inviteFriends(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = InviteFriendsBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const contest = this.contests.get(id);
    if (!contest) throw new NotFoundException({ error: 'Contest not found' });
    if (contest.hostUserId !== user.id) {
      throw new ForbiddenException({ error: 'Only the host can invite friends' });
    }
    if (contest.status !== 'registering') {
      throw new BadRequestException({ error: 'Registration is closed' });
    }
    if (parsed.data.friendUserIds.length === 0) {
      return { inviteCount: 0, challengeIds: [] as string[], contest };
    }
    const challenges = await this.friends.createFriendInvites(user.id, parsed.data.friendUserIds, {
      kind: 'contest',
      contestId: contest.id,
      inviteCode: contest.inviteCode,
    });
    let updatedContest = contest;
    if (challenges.length > 0) {
      const pending = challenges.map((ch) => {
        const friend = this.auth.getUser(ch.challengedId);
        return {
          userId: ch.challengedId,
          name: friend?.name ?? 'Friend',
        };
      });
      updatedContest = this.contests.recordPendingInvites(contest.id, pending) ?? contest;
    }
    return {
      inviteCount: challenges.length,
      challengeIds: challenges.map((c) => c.id),
      contest: updatedContest,
    };
  }

  @Get()
  listPublic() {
    return { contests: this.contests.listPublic() };
  }

  @Get('mine')
  @UseGuards(SessionAuthGuard)
  listMine(@CurrentUser() user: User) {
    return { contests: this.contests.listForUser(user.id) };
  }

  @Get('invite/:code')
  byInvite(@Param('code') code: string) {
    const contest = this.contests.getByInvite(code);
    if (!contest) throw new NotFoundException({ error: 'Contest not found' });
    return { contest };
  }

  @Get(':id/history')
  async historyList(@Param('id') id: string) {
    const hands = toPublicHandRows(await this.history.listHandsForContest(id, 50));
    return { hands };
  }

  @Get(':id/chat')
  async chatList(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const n = limit ? Number(limit) : 80;
    const b = before ? Number(before) : undefined;
    const messages = await this.history.listChat({
      contestId: id,
      limit: Number.isFinite(n) ? n : 80,
      before: b && Number.isFinite(b) ? b : undefined,
    });
    return { messages };
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    const contest = this.contests.get(id);
    if (!contest) throw new NotFoundException({ error: 'Contest not found' });
    return { contest };
  }

  @Post(':id/register')
  @UseGuards(SessionAuthGuard)
  async register(@CurrentUser() user: User, @Param('id') id: string) {
    const result = await this.contests.register(id, user.id, user.name);
    if (!result.ok) throw new BadRequestException({ error: result.error });
    return { contest: result.contest };
  }

  @Post(':id/unregister')
  @UseGuards(SessionAuthGuard)
  async unregister(@CurrentUser() user: User, @Param('id') id: string) {
    const result = await this.contests.unregister(id, user.id);
    if (!result.ok) throw new BadRequestException({ error: result.error });
    return { contest: result.contest };
  }

  @Post(':id/start')
  @UseGuards(SessionAuthGuard)
  async start(@CurrentUser() user: User, @Param('id') id: string) {
    const result = await this.contests.start(id, user.id);
    if (!result.ok) throw new BadRequestException({ error: result.error });
    return { contest: result.contest };
  }
}
