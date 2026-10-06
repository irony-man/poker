import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  AvatarUploadUrlBodySchema,
  ChangePasswordBodySchema,
  GoogleLinkBodySchema,
  SetEmailBodySchema,
  UpdateMeBodySchema,
  clampKeyboardShortcuts,
  resolveUiLook,
  type UiLooksConfig,
} from '@poker/protocol';
import { toAuthHttpError } from '../auth/auth.errors.js';
import { AuthError } from '../auth/auth.types.js';
import { CurrentUser } from '../common/session-auth.guard.js';
import { SessionAuthGuard } from '../common/session-auth.guard.js';
import type { User } from '../auth/auth.types.js';
import { AuthService } from '../auth/auth.service.js';
import { FriendsService } from '../friends/friends.service.js';
import { HistoryService, toOwnerHandRows } from '../history/history.service.js';
import { ALLOWED_AVATAR_CONTENT_TYPES } from '../storage/storage.constants.js';
import { StorageService } from '../storage/storage.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { listTrailFromQuery } from '../wallet/wallet-trail.query.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import {
  clampCardThemeId,
  resolveDefaultCardThemeId,
} from '../card-face-theme.js';

function toMeProfile(
  user: User,
  chipBalance: number,
  whuffieBalance: number,
  friendCount: number,
  uiLooks: UiLooksConfig,
) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarId: user.avatarId,
    avatarUrl: user.avatarUrl,
    tableColorId: user.tableColorId,
    cardThemeId: user.cardThemeId,
    uiTheme: resolveUiLook(uiLooks, user.uiTheme),
    tableLayout: user.tableLayout ?? 'v1',
    sfxMuted: user.sfxMuted === true,
    keyboardShortcuts: clampKeyboardShortcuts(user.keyboardShortcuts ?? {}),
    email: user.email,
    emailVerified: user.emailVerified,
    googleLinked: user.googleSub !== null,
    googleEmail: user.googleSub !== null ? user.googleEmail : null,
    instagramLinked: user.instagramId !== null,
    instagramUsername: user.instagramId !== null ? user.instagramUsername : null,
    hasPassword: user.passwordHash !== null,
    createdAt: user.createdAt,
    chipBalance,
    whuffieBalance,
    handsPlayed: user.handsPlayed ?? 0,
    friendCount,
    isAdmin: user.isAdmin === true,
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
    private readonly storage: StorageService,
    private readonly site: SiteConfigService,
  ) {}

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
      this.site.getUiLooks(),
    );
  }

  private async profileFor(user: User) {
    const friendCount = await this.friends.countFriends(user.id);
    return toMeProfile(
      user,
      this.wallet.getBalance(user.id),
      this.wallet.getWhuffieBalance(user.id),
      friendCount,
      this.site.getUiLooks(),
    );
  }

  /** Set the recovery email and send a confirmation link. */
  @Put('me/email')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async setEmail(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = SetEmailBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: 'Enter a valid email address' });
    }
    let updated: User;
    try {
      updated = await this.auth.setEmail(user.id, parsed.data.email);
    } catch (err) {
      if (err instanceof AuthError) throw toAuthHttpError(err, 'Could not save email');
      throw new ServiceUnavailableException({
        error: 'Email saved, but the confirmation email could not be sent. Try "Resend" later.',
      });
    }
    return this.profileFor(updated);
  }

  @Post('me/email/resend')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async resendEmail(@CurrentUser() user: User) {
    try {
      const updated = await this.auth.resendVerification(user.id);
      if (!updated) throw new UnauthorizedException({ error: 'Unknown user' });
      return this.profileFor(updated);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new ServiceUnavailableException({
        error: 'Could not send the confirmation email. Try again later.',
      });
    }
  }

  /** Change the password (or set one on a social-only account); returns a fresh session. */
  @Post('me/password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = ChangePasswordBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: 'New password must be 6–128 characters' });
    }
    try {
      return await this.auth.changePassword(
        user.id,
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );
    } catch (err) {
      // 400, not 401: a wrong current password must not look like an expired session.
      if (err instanceof AuthError && err.code === 'invalid_credentials') {
        throw new BadRequestException({ error: err.message });
      }
      throw toAuthHttpError(err, 'Could not change password');
    }
  }

  @Post('me/google')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async linkGoogle(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = GoogleLinkBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    try {
      return this.profileFor(await this.auth.linkGoogle(user.id, parsed.data.idToken));
    } catch (err) {
      throw toAuthHttpError(err, 'Could not connect Google');
    }
  }

  @Delete('me/google')
  async unlinkGoogle(@CurrentUser() user: User) {
    try {
      return this.profileFor(await this.auth.unlinkGoogle(user.id));
    } catch (err) {
      throw toAuthHttpError(err, 'Could not disconnect Google');
    }
  }

  @Delete('me/instagram')
  async unlinkInstagram(@CurrentUser() user: User) {
    try {
      return this.profileFor(await this.auth.unlinkInstagram(user.id));
    } catch (err) {
      throw toAuthHttpError(err, 'Could not disconnect Instagram');
    }
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

  @Get('me/wallet/trail')
  myWalletTrail(@CurrentUser() user: User, @Query() query: Record<string, unknown>) {
    return listTrailFromQuery(this.wallet, user.id, query);
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
    if (parsed.data.cardThemeId !== undefined) {
      const themes = this.site.getCardThemes();
      const allowed = themes.map((t) => t.id);
      const fallback = resolveDefaultCardThemeId(themes);
      const nextId = clampCardThemeId(parsed.data.cardThemeId, allowed, fallback);
      updated = await this.auth.setCardThemeId(user.id, nextId);
    }
    if (parsed.data.uiTheme !== undefined) {
      const nextLook = resolveUiLook(this.site.getUiLooks(), parsed.data.uiTheme);
      updated = await this.auth.setUiTheme(user.id, nextLook);
    }
    if (parsed.data.tableLayout !== undefined) {
      updated = await this.auth.setTableLayout(user.id, parsed.data.tableLayout);
    }
    if (parsed.data.sfxMuted !== undefined) {
      updated = await this.auth.setSfxMuted(user.id, parsed.data.sfxMuted);
    }
    if (parsed.data.keyboardShortcuts !== undefined) {
      updated = await this.auth.setKeyboardShortcuts(
        user.id,
        clampKeyboardShortcuts(parsed.data.keyboardShortcuts),
      );
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
      this.site.getUiLooks(),
    );
  }
}
