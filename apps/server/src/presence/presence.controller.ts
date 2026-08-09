import { Controller, Post, UseGuards } from '@nestjs/common';
import type { User } from '../auth/auth.types.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { PresenceService } from './presence.service.js';

@Controller('api/presence')
@UseGuards(SessionAuthGuard)
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  /** Lobby heartbeat so friends appear online for quick invite. */
  @Post()
  beat(@CurrentUser() user: User) {
    this.presence.touch(user.id);
    return { ok: true as const, onlineMs: PresenceService.ONLINE_MS };
  }
}
