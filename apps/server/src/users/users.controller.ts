import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpdateMeBodySchema } from '@poker/protocol';
import { isAdminUsername, parseAdminUsernames } from '../admin/admin-allowlist.js';
import { CurrentUser } from '../common/session-auth.guard.js';
import { SessionAuthGuard } from '../common/session-auth.guard.js';
import type { User } from '../auth/auth.types.js';
import { AuthService } from '../auth/auth.service.js';
import { WalletService } from '../wallet/wallet.service.js';

@Controller('api')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(
    private readonly auth: AuthService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
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
    return {
      id: fresh.id,
      username: fresh.username,
      name: fresh.name,
      avatarId: fresh.avatarId,
      tableColorId: fresh.tableColorId,
      createdAt: fresh.createdAt,
      chipBalance: this.wallet.getBalance(user.id),
      whuffieBalance: this.wallet.getWhuffieBalance(user.id),
      isAdmin: this.isAdmin(fresh),
    };
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
    if (parsed.data.avatarId !== undefined) {
      updated = await this.auth.setAvatarId(user.id, parsed.data.avatarId);
    }
    if (parsed.data.tableColorId !== undefined) {
      updated = await this.auth.setTableColorId(user.id, parsed.data.tableColorId);
    }
    if (!updated) {
      throw new UnauthorizedException({ error: 'Unknown user' });
    }
    return {
      id: updated.id,
      username: updated.username,
      name: updated.name,
      avatarId: updated.avatarId,
      tableColorId: updated.tableColorId,
      createdAt: updated.createdAt,
      chipBalance: this.wallet.getBalance(user.id),
      whuffieBalance: this.wallet.getWhuffieBalance(user.id),
      isAdmin: this.isAdmin(updated),
    };
  }
}
