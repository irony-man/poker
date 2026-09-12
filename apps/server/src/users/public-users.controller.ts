import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsernameSchema } from '@poker/protocol';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import type { User } from '../auth/auth.types.js';
import { bearerToken } from '../auth/bearer.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { FriendsService } from '../friends/friends.service.js';
import { HistoryService, toOwnerHandRows } from '../history/history.service.js';
import { PresenceService } from '../presence/presence.service.js';
import { WalletService } from '../wallet/wallet.service.js';

@Controller('api')
export class PublicUsersController {
  constructor(
    private readonly auth: AuthService,
    private readonly wallet: WalletService,
    private readonly friends: FriendsService,
    private readonly presence: PresenceService,
    private readonly history: HistoryService,
  ) {}

  @Get('users/:username')
  async publicProfile(
    @Param('username') rawUsername: string,
    @Req() req: Request,
  ) {
    const parsed = UsernameSchema.safeParse(rawUsername);
    if (!parsed.success) {
      throw new NotFoundException({ error: 'User not found' });
    }

    const user = this.auth.getUserByUsername(parsed.data);
    if (!user) {
      throw new NotFoundException({ error: 'User not found' });
    }

    await this.wallet.ensureStartingBalance(user.id);
    await this.wallet.ensureStartingWhuffies(user.id);
    const friendCount = await this.friends.countFriends(user.id);

    const body: {
      id: string;
      username: string;
      name: string;
      avatarId: number;
      avatarUrl: string | null;
      createdAt: number;
      handsPlayed: number;
      friendCount: number;
      chipBalance: number;
      whuffieBalance: number;
      relationship?: 'self' | 'friends' | 'outgoing' | 'incoming' | 'none';
      incomingRequestId?: string;
    } = {
      id: user.id,
      username: user.username,
      name: user.name,
      avatarId: user.avatarId,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      handsPlayed: user.handsPlayed ?? 0,
      friendCount,
      chipBalance: this.wallet.getBalance(user.id),
      whuffieBalance: this.wallet.getWhuffieBalance(user.id),
    };

    const token = bearerToken(
      req.header('authorization') ?? req.header('Authorization') ?? undefined,
    );
    if (token) {
      const viewer = this.auth.resolveSession(token);
      if (viewer) {
        this.presence.touch(viewer.id);
        const rel = await this.friends.getRelationship(viewer.id, user.id);
        body.relationship = rel.relationship;
        if (rel.incomingRequestId) {
          body.incomingRequestId = rel.incomingRequestId;
        }
      }
    }

    return body;
  }

  @Get('users/:username/hands-together')
  @UseGuards(SessionAuthGuard)
  async handsTogether(
    @Param('username') rawUsername: string,
    @CurrentUser() viewer: User,
    @Query('limit') limit?: string,
  ) {
    const parsed = UsernameSchema.safeParse(rawUsername);
    if (!parsed.success) {
      throw new NotFoundException({ error: 'User not found' });
    }

    const other = this.auth.getUserByUsername(parsed.data);
    if (!other) {
      throw new NotFoundException({ error: 'User not found' });
    }
    if (other.id === viewer.id) {
      throw new BadRequestException({ error: 'Use /api/me/hands for your own history' });
    }

    const n = limit ? Number(limit) : 50;
    const hands = toOwnerHandRows(
      await this.history.listHandsForUsers(
        viewer.id,
        other.id,
        Number.isFinite(n) ? n : 50,
      ),
      viewer.id,
    );
    return { hands };
  }
}
