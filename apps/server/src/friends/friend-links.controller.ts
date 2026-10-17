import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import type { User } from '../auth/auth.types.js';
import { bearerToken } from '../auth/bearer.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { FriendsService } from './friends.service.js';

@Controller('api/friend-links')
export class FriendLinksController {
  constructor(
    private readonly friends: FriendsService,
    private readonly auth: AuthService,
  ) {}

  /** Public owner card. With a session, also the visitor's relationship to the owner. */
  @Get(':code')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async resolve(@Param('code') code: string, @Req() req: Request) {
    const owner = await this.friends.friendLinkOwner(code);
    if (!owner) {
      throw new NotFoundException({ error: 'Invite link not found' });
    }
    const token = bearerToken(
      req.header('authorization') ?? req.header('Authorization') ?? undefined,
    );
    const viewer = token ? await this.auth.resolveSession(token) : null;
    if (!viewer) return { owner };
    const { relationship } = await this.friends.getRelationship(viewer.id, owner.userId);
    return { owner, relationship };
  }

  @Post(':code/redeem')
  @HttpCode(200)
  @UseGuards(SessionAuthGuard)
  async redeem(@CurrentUser() user: User, @Param('code') code: string) {
    const owner = await this.friends.friendLinkOwner(code);
    if (!owner) {
      throw new NotFoundException({ error: 'Invite link not found' });
    }
    const result = await this.friends.redeemFriendLink(user, code);
    if (!result.ok) {
      throw new BadRequestException({ error: result.error });
    }
    return { result: result.result, owner };
  }
}
