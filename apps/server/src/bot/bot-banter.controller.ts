import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  BOT_PERSONALITY_IDS,
  isBotPersonalityId,
  type ActionType,
  type BotBanterContext,
  type BotBanterTrigger,
  type BotPersonalityId,
  type Street,
  maybeBotBanter,
  pickBotBanterLine,
} from '@poker/engine';
import type { User } from '../auth/auth.types.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { BotBanterLlmService } from './bot-banter-llm.service.js';

interface BanterBody {
  personalityId?: string;
  botName?: string;
  trigger?: unknown;
  context?: BotBanterContext;
  /** When true, skip chance gate (caller already rolled). Default false. */
  force?: boolean;
}

const ACTIONS = new Set<string>(['fold', 'check', 'call', 'bet', 'raise', 'allin']);
const STREETS = new Set<string>(['preflop', 'flop', 'turn', 'river']);

function parseTrigger(raw: unknown): BotBanterTrigger | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (t.kind === 'win') return { kind: 'win' };
  if (t.kind === 'chat_reply') return { kind: 'chat_reply' };
  if (
    (t.kind === 'action' || t.kind === 'react') &&
    typeof t.action === 'string' &&
    ACTIONS.has(t.action) &&
    typeof t.street === 'string' &&
    STREETS.has(t.street)
  ) {
    return {
      kind: t.kind,
      action: t.action as ActionType,
      street: t.street as Street,
    };
  }
  return null;
}

@Controller('api/bot-banter')
export class BotBanterController {
  constructor(private readonly llm: BotBanterLlmService) {}

  /**
   * Offline / client helper: generate one banter line (LLM with template fallback).
   */
  @Post()
  @UseGuards(SessionAuthGuard)
  async generate(@CurrentUser() _user: User, @Body() body: BanterBody) {
    const personalityId = body.personalityId;
    if (!personalityId || !isBotPersonalityId(personalityId)) {
      throw new BadRequestException({
        error: `personalityId must be one of ${BOT_PERSONALITY_IDS.join(', ')}`,
      });
    }
    const trigger = parseTrigger(body.trigger);
    if (!trigger) {
      throw new BadRequestException({ error: 'Invalid trigger' });
    }
    const botName =
      typeof body.botName === 'string' && body.botName.trim()
        ? body.botName.trim().slice(0, 32)
        : 'Bot';
    const context = body.context && typeof body.context === 'object' ? body.context : undefined;

    const opts = {
      personalityId: personalityId as BotPersonalityId,
      trigger,
      context,
    };

    if (!body.force) {
      const gated = maybeBotBanter(opts);
      if (!gated) return { text: null as string | null, source: 'skip' as const };
      const llmLine = await this.llm.generateBanter({
        personalityId: opts.personalityId,
        botName,
        trigger,
        context,
      });
      return {
        text: llmLine ?? gated,
        source: llmLine ? ('llm' as const) : ('template' as const),
      };
    }

    const llmLine = await this.llm.generateBanter({
      personalityId: opts.personalityId,
      botName,
      trigger,
      context,
    });
    return {
      text: llmLine ?? pickBotBanterLine(opts),
      source: llmLine ? ('llm' as const) : ('template' as const),
    };
  }
}
