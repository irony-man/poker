import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { User } from '../auth/auth.types.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { defaultBotChatProvider } from './bot-chat.providers.js';
import { parseBotChatBody } from './bot-chat.parse.js';
import { BotChatService } from './bot-chat.service.js';

@Controller('api/bot-chat')
export class BotChatController {
  constructor(private readonly chat: BotChatService) {}

  @Get('providers')
  @UseGuards(SessionAuthGuard)
  listProviders(@CurrentUser() _user: User) {
    const providers = this.chat.listProviders();
    const preferred = defaultBotChatProvider();
    return {
      providers,
      default: providers.includes(preferred) ? preferred : (providers[0] ?? null),
    };
  }

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
    if (!this.chat.listProviders().includes(parsed.value.llmProvider)) {
      const configErr = this.chat.configurationError(parsed.value.llmProvider);
      res.status(503).json({ error: configErr ?? 'Bot chat is not available' });
      return;
    }

    if (parsed.value.stream) {
      await this.chat.streamTo(
        res,
        parsed.value.persona,
        parsed.value.messages,
        parsed.value.llmProvider,
      );
      return;
    }

    const { text, error } = await this.chat.completeDetailed(
      parsed.value.persona,
      parsed.value.messages,
      parsed.value.llmProvider,
    );
    if (!text) {
      res.status(503).json({ error: error ?? 'Bot chat is not available' });
      return;
    }
    res.json({ text, persona: parsed.value.persona, llmProvider: parsed.value.llmProvider });
  }
}
