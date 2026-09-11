import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
} from '@nestjs/common';
import { UsernameSchema } from '@poker/protocol';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { bearerToken } from '../auth/bearer.js';
import { FriendsService } from '../friends/friends.service.js';
import { PresenceService } from '../presence/presence.service.js';
import { WalletService } from '../wallet/wallet.service.js';

@Controller('api')
export class PublicUsersController {
  constructor(
    private readonly auth: AuthService,
    private readonly wallet: WalletService,
    private readonly friends: FriendsService,
    private readonly presence: PresenceService,
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
}
