import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateLudoBodySchema } from '@poker/protocol';
import type { User } from '../auth/auth.types.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { FriendsService } from '../friends/friends.service.js';
import { LudoRoomsService } from './ludo.service.js';

@Controller('api/ludo')
export class LudoController {
  constructor(
    private readonly ludo: LudoRoomsService,
    private readonly friends: FriendsService,
  ) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  async create(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = CreateLudoBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const d = parsed.data;
    const maxBots = Math.max(0, d.maxSeats - 1);
    const bots = Math.min(d.botCount, maxBots);
    let meta;
    try {
      meta = this.ludo.create({
        name: d.name,
        hostUserId: user.id,
        maxSeats: d.maxSeats as 2 | 3 | 4,
        inviteCode: d.inviteCode,
        botCount: bots,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create board';
      if (message.includes('already in use')) {
        throw new ConflictException({ error: message });
      }
      throw new BadRequestException({ error: message });
    }

    let inviteCount = 0;
    if (d.inviteFriendIds.length > 0) {
      const invites = await this.friends.createFriendInvites(user.id, d.inviteFriendIds, {
        kind: 'ludo',
        ludoId: meta.id,
        inviteCode: meta.inviteCode,
      });
      inviteCount = invites.length;
    }

    return {
      ludoId: meta.id,
      inviteCode: meta.inviteCode,
      name: meta.name,
      maxSeats: meta.maxSeats,
      botsAdded: bots,
      inviteCount,
    };
  }

  @Get('invite/:code')
  byInvite(@Param('code') code: string) {
    const room = this.ludo.getByInvite(code);
    if (!room) throw new NotFoundException({ error: 'Board not found' });
    return {
      ludoId: room.meta.id,
      inviteCode: room.meta.inviteCode,
      name: room.meta.name,
      maxSeats: room.meta.maxSeats,
    };
  }

  @Get(':id/chat')
  chatList(@Param('id') id: string, @Query('limit') limit?: string) {
    const room = this.ludo.get(id);
    if (!room) throw new NotFoundException({ error: 'Board not found' });
    const n = limit ? Number(limit) : 80;
    return { messages: room.listChat(Number.isFinite(n) ? n : 80) };
  }
}
