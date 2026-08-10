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
  UseGuards,
} from '@nestjs/common';
import { CreateTableBodySchema, InviteFriendsBodySchema } from '@poker/protocol';
import type { User } from '../auth/auth.types.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { FriendsService } from '../friends/friends.service.js';
import { HistoryService } from '../history/history.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { SiteConfigService } from '../site-config/site-config.service.js';

@Controller('api/tables')
export class TablesController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly friends: FriendsService,
    private readonly history: HistoryService,
    private readonly site: SiteConfigService,
  ) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  async create(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = CreateTableBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const d = parsed.data;
    if (d.bigBlind < d.smallBlind) {
      throw new BadRequestException({ error: 'bigBlind must be >= smallBlind' });
    }
    const maxBots = Math.max(0, d.maxSeats - 1);
    const bots = Math.min(d.botCount, maxBots);
    // Private host tables with bots are free practice (no bankroll moves).
    const playMoney = d.isPrivate && bots > 0;
    let meta;
    try {
      meta = this.rooms.create({
        name: d.name,
        hostUserId: user.id,
        isPrivate: d.isPrivate,
        inviteCode: d.inviteCode,
        playMoney,
        config: {
          maxSeats: d.maxSeats,
          smallBlind: d.smallBlind,
          bigBlind: d.bigBlind,
          buyIn: d.buyIn,
          turnTimeMs: d.turnTimeMs,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create table';
      if (message.includes('already in use')) {
        throw new ConflictException({ error: message });
      }
      throw new BadRequestException({ error: message });
    }
    const room = this.rooms.get(meta.id)!;
    if (bots > 0) {
      const namePool = this.site.getBotNamePool(d.botGroupId);
      room.addBot(user.id, undefined, d.buyIn, bots, namePool);
    }

    let inviteCount = 0;
    if (d.inviteFriendIds.length > 0) {
      const invites = await this.friends.createFriendInvites(user.id, d.inviteFriendIds, {
        kind: 'table',
        tableId: meta.id,
        inviteCode: meta.inviteCode,
      });
      inviteCount = invites.length;
    }

    return {
      tableId: meta.id,
      inviteCode: meta.inviteCode,
      name: meta.name,
      config: meta.config,
      botsAdded: bots,
      inviteCount,
    };
  }

  @Get()
  listPublic() {
    return { tables: this.rooms.listPublicLobby() };
  }

  @Get('invite/:code')
  byInvite(@Param('code') code: string) {
    const room = this.rooms.getByInvite(code);
    if (!room) throw new NotFoundException({ error: 'Table not found' });
    return {
      tableId: room.meta.id,
      inviteCode: room.meta.inviteCode,
      name: room.meta.name,
      config: room.meta.config,
    };
  }

  @Get(':id/history')
  async historyList(@Param('id') id: string) {
    const hands = await this.history.listHands(id, 50);
    return { hands };
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
    const room = this.rooms.get(id);
    if (!room) throw new NotFoundException({ error: 'Table not found' });
    if (room.meta.hostUserId !== user.id) {
      throw new ForbiddenException({ error: 'Only the host can invite friends' });
    }
    if (parsed.data.friendUserIds.length === 0) {
      return { inviteCount: 0, challengeIds: [] as string[] };
    }
    const challenges = await this.friends.createFriendInvites(user.id, parsed.data.friendUserIds, {
      kind: 'table',
      tableId: room.meta.id,
      inviteCode: room.meta.inviteCode,
    });
    return {
      inviteCount: challenges.length,
      challengeIds: challenges.map((c) => c.id),
    };
  }
}
