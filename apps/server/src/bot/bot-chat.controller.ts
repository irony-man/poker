import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { User } from '../auth/auth.types.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { parseBotChatBody } from './bot-chat.parse.js';
import { BotChatService } from './bot-chat.service.js';

@Controller('api/bot-chat')
export class BotChatController {
  constructor(private readonly chat: BotChatService) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(
    @CurrentUser() _user: User,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    const parsed = parseBotChatBody(body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const configErr = this.chat.configurationError();
    if (configErr) {
      res.status(503).json({ error: configErr });
      return;
    }

    if (parsed.value.stream) {
      await this.chat.streamTo(res, parsed.value.persona, parsed.value.messages);
      return;
    }

    const text = await this.chat.complete(parsed.value.persona, parsed.value.messages);
    if (!text) {
      res.status(503).json({ error: 'Bot chat is not available' });
      return;
    }
    res.json({ text, persona: parsed.value.persona });
  }
}
