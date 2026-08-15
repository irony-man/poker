import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { ChatMessageRow, HandHistoryRow } from '@poker/db';
import { AuthService } from '../auth/auth.service.js';
import { isBotUserId } from '../bot.js';
import { dataSourceAsQueryable } from '../database/queryable.js';
import type { TableMeta } from '../rooms/room.js';
import {
  FileHistoryStore,
  PostgresHistoryStore,
  playerUserIdsFromResult,
  type HandHistoryPage,
  type HandHistoryStore,
  type ListChatQuery,
  type ListHandsPageQuery,
  type RecordChatInput,
  type RecordHandInput,
  writeSchemaDoc,
} from './history.store.js';

export interface HandHistorySummary {
  id: string;
  tableId: string;
  handId: string;
  contestId: string | null;
  source: string;
  startedAt: Date;
  endedAt: Date | null;
  playerNames: string[];
  winners: { seat: number; amount: number; name?: string; handName?: string }[];
}

function parseResult(resultJson: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(resultJson) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Public history APIs must not leak unrevealed hole cards. */
export function redactUnrevealedHoleCards(resultJson: string, viewerUserId?: string): string {
  const result = parseResult(resultJson);
  if (!result || !Array.isArray(result.players)) return resultJson;
  const players = result.players.map((p) => {
    if (!p || typeof p !== 'object') return p;
    const rec = p as { revealed?: unknown; userId?: unknown };
    if (rec.revealed === true) return p;
    if (viewerUserId && rec.userId === viewerUserId) return p;
    return { ...rec, holeCards: null };
  });
  return JSON.stringify({ ...result, players });
}

export function toPublicHandRows(rows: HandHistoryRow[]): HandHistoryRow[] {
  return rows.map((row) => ({ ...row, resultJson: redactUnrevealedHoleCards(row.resultJson) }));
}

/** Profile /me/hands: keep the viewer's hole cards, redact everyone else's folds. */
export function toOwnerHandRows(rows: HandHistoryRow[], userId: string): HandHistoryRow[] {
  return rows.map((row) => ({
    ...row,
    resultJson: redactUnrevealedHoleCards(row.resultJson, userId),
  }));
}

export function summarizeHand(row: HandHistoryRow): HandHistorySummary {
  const result = parseResult(row.resultJson);
  const players = Array.isArray(result?.players) ? result.players : [];
  const playerNames: string[] = [];
  const nameBySeat = new Map<number, string>();
  for (const p of players) {
    if (!p || typeof p !== 'object') continue;
    const rec = p as { seat?: unknown; name?: unknown };
    const name = typeof rec.name === 'string' && rec.name ? rec.name : null;
    if (name) playerNames.push(name);
    if (typeof rec.seat === 'number' && name) nameBySeat.set(rec.seat, name);
  }
  const winnersRaw = Array.isArray(result?.winners) ? result.winners : [];
  const winners = winnersRaw.flatMap((w) => {
    if (!w || typeof w !== 'object') return [];
    const rec = w as { seat?: unknown; amount?: unknown; handName?: unknown };
    if (typeof rec.seat !== 'number' || typeof rec.amount !== 'number') return [];
    return [
      {
        seat: rec.seat,
        amount: rec.amount,
        name: nameBySeat.get(rec.seat),
        handName: typeof rec.handName === 'string' ? rec.handName : undefined,
      },
    ];
  });
  return {
    id: row.id,
    tableId: row.tableId,
    handId: row.handId,
    contestId: row.contestId ?? null,
    source: row.source ?? 'online',
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    playerNames,
    winners,
  };
}

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
      await this.ensureHistorySchema();
      await this.backfillHandsPlayed();
    } catch (err) {
      console.error('[history] schema/backfill failed', err);
    }
  }

  /** RoomManager should call through this wrapper so handsPlayed increments. */
  asStore(): HandHistoryStore {
    return this;
  }

  recordTable(meta: TableMeta): Promise<void> {
    return this.store.recordTable(meta);
  }

  async recordHand(input: RecordHandInput): Promise<boolean> {
    const inserted = await this.store.recordHand(input);
    if (!inserted) return false;
    try {
      await this.incrementFromResult(input.result);
    } catch (err) {
      console.error('[history] handsPlayed increment failed', err);
    }
    return true;
  }

  recordChat(input: RecordChatInput): Promise<void> {
    return this.store.recordChat(input);
  }

  listHands(tableId: string, limit?: number): Promise<HandHistoryRow[]> {
    return this.store.listHands(tableId, limit);
  }

  listHandsForContest(contestId: string, limit?: number): Promise<HandHistoryRow[]> {
    return this.store.listHandsForContest(contestId, limit);
  }

  listHandsForUser(userId: string, limit?: number): Promise<HandHistoryRow[]> {
    return this.store.listHandsForUser(userId, limit);
  }

  listHandsPage(query: ListHandsPageQuery): Promise<HandHistoryPage> {
    return this.store.listHandsPage(query);
  }

  getHandById(id: string): Promise<HandHistoryRow | null> {
    return this.store.getHandById(id);
  }

  listChat(query: ListChatQuery): Promise<ChatMessageRow[]> {
    return this.store.listChat(query);
  }

  countHandsForUser(userId: string): Promise<number> {
    return this.store.countHandsForUser(userId);
  }

  countHandsByUser(): Promise<Map<string, number>> {
    return this.store.countHandsByUser();
  }

  async listHandsPageSummaries(query: ListHandsPageQuery): Promise<{
    items: HandHistorySummary[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = await this.store.listHandsPage(query);
    return {
      ...page,
      items: page.items.map(summarizeHand),
    };
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

  private async ensureHistorySchema(): Promise<void> {
    await this.dataSource.query(
      `ALTER TABLE hand_history ADD COLUMN IF NOT EXISTS contest_id text`,
    );
    await this.dataSource.query(
      `ALTER TABLE hand_history ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'online'`,
    );
    await this.dataSource.query(`
      DELETE FROM hand_history a
      USING hand_history b
      WHERE a.table_id = b.table_id
        AND a.hand_id = b.hand_id
        AND (
          a.started_at > b.started_at
          OR (a.started_at = b.started_at AND a.id > b.id)
        )
    `);
    await this.dataSource.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS hand_history_table_hand_uidx ON hand_history (table_id, hand_id)`,
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS hand_history_contest_idx ON hand_history (contest_id)`,
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
