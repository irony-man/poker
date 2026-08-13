import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { HandHistoryRow } from '@poker/db';
import { AuthService } from '../auth/auth.service.js';
import { isBotUserId } from '../bot.js';
import { dataSourceAsQueryable } from '../database/queryable.js';
import type { TableMeta } from '../rooms/room.js';
import {
  FileHistoryStore,
  PostgresHistoryStore,
  playerUserIdsFromResult,
  type HandHistoryStore,
  writeSchemaDoc,
} from './history.store.js';

@Injectable()
export class HistoryService implements HandHistoryStore, OnModuleInit {
  private store!: HandHistoryStore;

  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.store = new PostgresHistoryStore(dataSourceAsQueryable(this.dataSource));
  }

  async onModuleInit(): Promise<void> {
    const dataDir = this.config.get<string>('DATA_DIR') ?? `${process.cwd()}/data`;
    await writeSchemaDoc(dataDir);
    try {
      await this.ensureHandsPlayedColumn();
      await this.backfillHandsPlayed();
    } catch (err) {
      console.error('[history] handsPlayed backfill failed', err);
    }
  }

  /** RoomManager should call through this wrapper so handsPlayed increments. */
  asStore(): HandHistoryStore {
    return this;
  }

  recordTable(meta: TableMeta): Promise<void> {
    return this.store.recordTable(meta);
  }

  async recordHand(input: {
    tableId: string;
    handId: string;
    startedAt: number;
    endedAt: number;
    result: unknown;
  }): Promise<void> {
    await this.store.recordHand(input);
    try {
      await this.incrementFromResult(input.result);
    } catch (err) {
      console.error('[history] handsPlayed increment failed', err);
    }
  }

  listHands(tableId: string, limit?: number): Promise<HandHistoryRow[]> {
    return this.store.listHands(tableId, limit);
  }

  countHandsForUser(userId: string): Promise<number> {
    return this.store.countHandsForUser(userId);
  }

  countHandsByUser(): Promise<Map<string, number>> {
    return this.store.countHandsByUser();
  }

  private async incrementFromResult(result: unknown): Promise<void> {
    const ids = playerUserIdsFromResult(result).filter((id) => !isBotUserId(id));
    for (const userId of ids) {
      await this.auth.incrementHandsPlayed(userId);
    }
  }

  private async ensureHandsPlayedColumn(): Promise<void> {
    await this.dataSource.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS hands_played integer NOT NULL DEFAULT 0`,
    );
  }

  private async backfillHandsPlayed(): Promise<void> {
    const counts = await this.store.countHandsByUser();
    const humans = new Map<string, number>();
    for (const [userId, n] of counts) {
      if (isBotUserId(userId)) continue;
      humans.set(userId, n);
    }
    await this.auth.applyHandsPlayedCounts(humans);
  }
}

export { FileHistoryStore, type HandHistoryStore };
