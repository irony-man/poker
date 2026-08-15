import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AvatarUploadUrlBodySchema, UpdateMeBodySchema } from '@poker/protocol';
import { isAdminUsername, parseAdminUsernames } from '../admin/admin-allowlist.js';
import { CurrentUser } from '../common/session-auth.guard.js';
import { SessionAuthGuard } from '../common/session-auth.guard.js';
import type { User } from '../auth/auth.types.js';
import { AuthService } from '../auth/auth.service.js';
import { FriendsService } from '../friends/friends.service.js';
import { HistoryService, toOwnerHandRows } from '../history/history.service.js';
import { ALLOWED_AVATAR_CONTENT_TYPES } from '../storage/storage.constants.js';
import { StorageService } from '../storage/storage.service.js';
import { WalletService } from '../wallet/wallet.service.js';

function toMeProfile(
  user: User,
  chipBalance: number,
  whuffieBalance: number,
  friendCount: number,
  isAdmin: boolean,
) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarId: user.avatarId,
    avatarUrl: user.avatarUrl,
    tableColorId: user.tableColorId,
    createdAt: user.createdAt,
    chipBalance,
    whuffieBalance,
    handsPlayed: user.handsPlayed ?? 0,
    friendCount,
    isAdmin,
  };
}

@Controller('api')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(
    private readonly auth: AuthService,
    private readonly wallet: WalletService,
    private readonly friends: FriendsService,
    private readonly history: HistoryService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  private isAdmin(user: User): boolean {
    return isAdminUsername(
      user.username,
      parseAdminUsernames(this.config.get<string>('ADMIN_USERNAMES')),
    );
  }

  @Get('me')
  async me(@CurrentUser() user: User) {
    await this.wallet.ensureStartingBalance(user.id);
    await this.wallet.ensureStartingWhuffies(user.id);
    const fresh = this.auth.getUser(user.id);
    if (!fresh) {
      throw new UnauthorizedException({ error: 'Unknown user' });
    }
    const friendCount = await this.friends.countFriends(fresh.id);
    return toMeProfile(
      fresh,
      this.wallet.getBalance(user.id),
      this.wallet.getWhuffieBalance(user.id),
      friendCount,
      this.isAdmin(fresh),
    );
  }

  @Get('me/hands')
  async myHands(@CurrentUser() user: User, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 50;
    const hands = toOwnerHandRows(
      await this.history.listHandsForUser(user.id, Number.isFinite(n) ? n : 50),
      user.id,
    );
    return { hands };
  }

  @Post('me/avatar/upload-url')
  async avatarUploadUrl(@CurrentUser() user: User, @Body() body: unknown) {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException({ error: 'File storage is not configured' });
    }
    const parsed = AvatarUploadUrlBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const ext = ALLOWED_AVATAR_CONTENT_TYPES[parsed.data.contentType];
    const key = this.storage.avatarUploadKey(user.id, ext);
    const result = await this.storage.createPresignedUpload({
      key,
      contentType: parsed.data.contentType,
      contentLength: parsed.data.contentLength,
    });
    return result;
  }

  @Patch('me')
  async patchMe(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = UpdateMeBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    let updated: User | null = this.auth.getUser(user.id) ?? null;
    if (!updated) {
      throw new UnauthorizedException({ error: 'Unknown user' });
    }

    if (parsed.data.avatarUrl !== undefined) {
      if (parsed.data.avatarUrl === null) {
        const previous = updated.avatarUrl;
        updated = await this.auth.setAvatarUrl(user.id, null);
        if (previous) {
          const key = this.storage.keyFromPublicUrl(previous);
          if (key) void this.storage.deleteObject(key);
        }
      } else {
        if (!this.storage.isConfigured()) {
          throw new ServiceUnavailableException({ error: 'File storage is not configured' });
        }
        if (!this.storage.isAllowedAvatarUrl(parsed.data.avatarUrl)) {
          throw new BadRequestException({ error: 'Invalid avatar URL' });
        }
        const key = this.storage.keyFromPublicUrl(parsed.data.avatarUrl);
        if (!key || !key.startsWith(`uploads/avatars/${user.id}/`)) {
          throw new BadRequestException({ error: 'Avatar URL must belong to your account' });
        }
        const exists = await this.storage.headObject(key);
        if (!exists) {
          throw new BadRequestException({ error: 'Uploaded avatar not found' });
        }
        const previous = updated.avatarUrl;
        updated = await this.auth.setAvatarUrl(user.id, parsed.data.avatarUrl);
        if (previous && previous !== parsed.data.avatarUrl) {
          const oldKey = this.storage.keyFromPublicUrl(previous);
          if (oldKey) void this.storage.deleteObject(oldKey);
        }
      }
    }

    if (parsed.data.avatarId !== undefined) {
      updated = await this.auth.setAvatarId(user.id, parsed.data.avatarId);
    }
    if (parsed.data.tableColorId !== undefined) {
      updated = await this.auth.setTableColorId(user.id, parsed.data.tableColorId);
    }
    if (!updated) {
      throw new UnauthorizedException({ error: 'Unknown user' });
    }
    const friendCount = await this.friends.countFriends(updated.id);
    return toMeProfile(
      updated,
      this.wallet.getBalance(user.id),
      this.wallet.getWhuffieBalance(user.id),
      friendCount,
      this.isAdmin(updated),
    );
  }
}
