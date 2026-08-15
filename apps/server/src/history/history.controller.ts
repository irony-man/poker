import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UploadHandBodySchema } from '@poker/protocol';
import type { User } from '../auth/auth.types.js';
import { isBotUserId } from '../bot.js';
import { CurrentUser, SessionAuthGuard } from '../common/session-auth.guard.js';
import { playerUserIdsFromResult } from './history.store.js';
import { HistoryService } from './history.service.js';

const OFFLINE_HUMAN_ID = 'offline-human';

function rewriteOfflineIdentity(value: unknown, userId: string, name: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteOfflineIdentity(item, userId, name));
  }
  if (!value || typeof value !== 'object') return value;
  const rec = { ...(value as Record<string, unknown>) };
  if (rec.userId === OFFLINE_HUMAN_ID) {
    rec.userId = userId;
    if (typeof rec.name !== 'string' || !rec.name) rec.name = name;
  }
  for (const key of Object.keys(rec)) {
    const child = rec[key];
    if (child && typeof child === 'object') {
      rec[key] = rewriteOfflineIdentity(child, userId, name);
    }
  }
  return rec;
}

@Controller('api/history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Post('hands')
  @UseGuards(SessionAuthGuard)
  async uploadHand(@CurrentUser() user: User, @Body() body: unknown) {
    const parsed = UploadHandBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ error: parsed.error.message });
    }
    const d = parsed.data;
    const result = rewriteOfflineIdentity(d.result, user.id, user.name);
    const chat = (d.chat ?? []).map((line) => ({
      ...line,
      userId: line.userId === OFFLINE_HUMAN_ID ? user.id : line.userId,
      name: line.userId === OFFLINE_HUMAN_ID ? user.name : line.name,
    }));
    const playerIds = playerUserIdsFromResult(result);
    if (!playerIds.includes(user.id)) {
      throw new ForbiddenException({ error: 'You must be a player in this hand' });
    }

    await this.history.recordTable({
      id: d.tableId,
      inviteCode: d.tableId,
      name: 'Solo',
      hostUserId: user.id,
      isPrivate: true,
      playMoney: true,
      createdAt: Date.now(),
      config: {
        maxSeats: 6,
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
      },
    });

    const inserted = await this.history.recordHand({
      tableId: d.tableId,
      handId: d.handId,
      startedAt: d.startedAt,
      endedAt: d.endedAt,
      contestId: d.contestId ?? null,
      source: 'offline',
      result,
    });

    if (inserted) {
      const resultChat = Array.isArray((result as { chat?: unknown }).chat)
        ? ((result as { chat: typeof chat }).chat ?? [])
        : [];
      const lines = chat.length > 0 ? chat : resultChat;
      for (const line of lines) {
        const kind =
          line.kind ??
          (line.userId === 'system' || isBotUserId(line.userId) ? 'system' : 'user');
        await this.history.recordChat({
          tableId: d.tableId,
          contestId: d.contestId ?? null,
          handId: d.handId,
          userId: line.userId,
          name: line.name,
          text: line.text,
          at: line.at,
          kind,
          source: 'offline',
        });
      }
    }

    return { ok: true, inserted };
  }
}
