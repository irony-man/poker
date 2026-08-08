import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UpdateMeBodySchema } from '@poker/protocol';
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
  ) {}

  @Get('me')
  async me(@CurrentUser() user: User) {
    await this.wallet.ensureStartingBalance(user.id);
    const fresh = this.auth.getUser(user.id);
    if (!fresh) {
      throw new UnauthorizedException({ error: 'Unknown user' });
    }
    return {
      id: fresh.id,
      username: fresh.username,
      name: fresh.name,
      avatarId: fresh.avatarId,
      createdAt: fresh.createdAt,
      chipBalance: this.wallet.getBalance(user.id),
    };
  }

  @Patch('me')
  async patchMe(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = UpdateMeBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const updated = await this.auth.setAvatarId(user.id, parsed.data.avatarId);
    if (!updated) {
      throw new UnauthorizedException({ error: 'Unknown user' });
    }
    return {
      id: updated.id,
      username: updated.username,
      name: updated.name,
      avatarId: updated.avatarId,
      createdAt: updated.createdAt,
      chipBalance: this.wallet.getBalance(user.id),
    };
  }
}
