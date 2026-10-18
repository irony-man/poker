import { Injectable, Optional, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { ChatMessageRow, HandHistoryRow } from '@poker/db';
import {
  handOpponents,
  handPayouts,
  isAnalyzableHand,
  type HandOpponents,
  type HandResultPayload,
} from '@poker/engine';
import { AuthService } from '../auth/auth.service.js';
import { BotChatService } from '../bot/bot-chat.service.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import { clampAnalysisDailyLimit } from '../site-config/site-config.types.js';
import { isBotUserId } from '../bot.js';
import { dataSourceAsQueryable } from '../database/queryable.js';
import type { TableMeta } from '../rooms/room.js';
import {
  FileHistoryStore,
  PostgresHistoryStore,
  clampUserHandsLimit,
  playerUserIdsFromResult,
  type HandHistoryPage,
  type HandHistoryStore,
  type ListChatQuery,
  type ListHandsPageQuery,
  type ListUserHandsQuery,
  type RecordChatInput,
  type RecordHandInput,
  writeSchemaDoc,
} from './history.store.js';
import {
  runTableCoach,
  utcCoachDay,
  type CoachOutcome,
  type CoachQuota,
  type CoachReviewRow,
  coachQuota,
  reviewsFromStored,
  summaryFromStored,
} from './hand-coach.js';

class CoachSlotDenied extends Error {
  constructor() {
    super('coach-limit');
  }
}

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

function parseResult(resultJson: unknown): Record<string, unknown> | null {
  if (resultJson && typeof resultJson === 'object') {
    return resultJson as Record<string, unknown>;
  }
  if (typeof resultJson !== 'string') return null;
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

export type AnalysisQuery = Omit<ListUserHandsQuery, 'userId'> & { opponents?: HandOpponents };

export interface AnalysisTableSummary {
  tableId: string;
  source: string;
  opponents: HandOpponents;
  firstAt: number;
  lastAt: number;
  hands: number;
  handsWon: number;
  /** Other players dealt in at this table, most recent first. */
  players: AnalysisTablePlayer[];
  /** A coaching review has been saved for this table. */
  coached: boolean;
}

export interface AnalysisTablePlayer {
  userId: string;
  name: string;
  isBot: boolean;
}

const MAX_TABLE_PLAYERS = 50;

function addTablePlayers(
  table: AnalysisTableSummary,
  result: HandResultPayload,
  viewerUserId: string,
): void {
  for (const p of result.players ?? []) {
    if (table.players.length >= MAX_TABLE_PLAYERS) return;
    const id = p?.userId;
    if (!id || id === viewerUserId || table.players.some((x) => x.userId === id)) continue;
    const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : null;
    if (!name) continue;
    table.players.push({ userId: id, name, isBot: isBotUserId(id) });
  }
}

/** Returned uncalled chips do not count as a win. */
function viewerWon(result: HandResultPayload, userId: string): boolean {
  const seat = result.players?.find((p) => p?.userId === userId)?.seat;
  if (typeof seat !== 'number') return false;
  return handPayouts(result).some((p) => p.seat === seat && p.won > 0);
}

/** Analysis view: the viewer's cards, showdown reveals, and every bot's cards. */
export function redactForAnalysis(resultJson: string, viewerUserId: string): string {
  const result = parseResult(resultJson);
  if (!result || !Array.isArray(result.players)) return resultJson;
  const players = result.players.map((p) => {
    if (!p || typeof p !== 'object') return p;
    const rec = p as { revealed?: unknown; userId?: unknown };
    if (rec.revealed === true || rec.userId === viewerUserId) return p;
    if (typeof rec.userId === 'string' && isBotUserId(rec.userId)) return p;
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
    @Optional() private readonly chat?: BotChatService,
    @Optional() private readonly siteConfig?: SiteConfigService,
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

  listHandsForUserPage(query: ListUserHandsQuery): Promise<HandHistoryRow[]> {
    return this.store.listHandsForUserPage(query);
  }

  /**
   * Analysable hands for the viewer, redacted for analysis. Filtering happens after
   * the query (showdown rule, opponent kind), so it scans batches until the page is
   * full, history runs out, or the scan budget is spent.
   */
  async listAnalysisHands(
    userId: string,
    query: AnalysisQuery,
  ): Promise<{ hands: HandHistoryRow[]; nextBefore: number | null }> {
    const limit = clampUserHandsLimit(query.limit, 30);
    const hands: HandHistoryRow[] = [];
    const scan = await this.scanAnalysable(userId, query, (row) => {
      hands.push({ ...row, resultJson: redactForAnalysis(row.resultJson, userId) });
      return hands.length >= limit ? 'stop-after' : 'continue';
    });
    const nextBefore =
      !scan.exhausted && scan.lastScanned ? new Date(scan.lastScanned.startedAt).getTime() : null;
    return { hands, nextBefore };
  }

  /** Tables with analysable hands, most recently played first. */
  async listAnalysisTables(
    userId: string,
    query: AnalysisQuery,
  ): Promise<{ tables: AnalysisTableSummary[]; nextBefore: number | null }> {
    const limit = Math.min(50, Math.max(1, Math.floor(query.limit ?? 20)));
    const byTable = new Map<string, AnalysisTableSummary>();
    const scan = await this.scanAnalysable(userId, query, (row, result) => {
      let table = byTable.get(row.tableId);
      if (!table) {
        if (byTable.size >= limit) return 'stop-before';
        table = {
          tableId: row.tableId,
          source: row.source ?? 'online',
          opponents: handOpponents(result, userId, row.source),
          firstAt: new Date(row.startedAt).getTime(),
          lastAt: new Date(row.startedAt).getTime(),
          hands: 0,
          handsWon: 0,
          players: [],
          coached: false,
        };
        byTable.set(row.tableId, table);
      }
      table.hands += 1;
      addTablePlayers(table, result, userId);
      table.firstAt = Math.min(table.firstAt, new Date(row.startedAt).getTime());
      if (handOpponents(result, userId, row.source) === 'players') table.opponents = 'players';
      if (viewerWon(result, userId)) table.handsWon += 1;
      return 'continue';
    });
    let nextBefore: number | null = null;
    if (scan.stoppedBefore) nextBefore = new Date(scan.stoppedBefore.startedAt).getTime() + 1;
    else if (!scan.exhausted && scan.lastScanned) {
      nextBefore = new Date(scan.lastScanned.startedAt).getTime();
    }
    const tables = [...byTable.values()];
    const coached = await this.coachedTableIds(
      userId,
      tables.map((t) => t.tableId),
    );
    for (const table of tables) table.coached = coached.has(table.tableId);
    return { tables, nextBefore };
  }

  /** Tables that already have a saved coaching review, on any day. */
  private async coachedTableIds(userId: string, tableIds: string[]): Promise<Set<string>> {
    if (tableIds.length === 0 || typeof this.dataSource?.query !== 'function') return new Set();
    const res = await this.dataSource.query(
      `SELECT DISTINCT table_id as "tableId"
       FROM hand_coach_reviews
       WHERE user_id = $1 AND table_id = ANY($2::text[])`,
      [userId, tableIds],
    );
    const rows = Array.isArray(res) ? (res as { tableId: string }[]) : [];
    return new Set(rows.map((r) => r.tableId));
  }

  /**
   * Walks the viewer's history newest first in batches, handing analysable hands
   * (showdown rule and opponent filter applied) to `visit` until it stops, history
   * runs out, or the scan budget is spent.
   */
  private async scanAnalysable(
    userId: string,
    query: AnalysisQuery,
    visit: (
      row: HandHistoryRow,
      result: HandResultPayload,
    ) => 'continue' | 'stop-after' | 'stop-before',
  ): Promise<{
    exhausted: boolean;
    lastScanned: HandHistoryRow | null;
    stoppedBefore: HandHistoryRow | null;
  }> {
    const batchSize = 200;
    const maxScanned = 2000;
    let before = query.before;
    let scanned = 0;
    let lastScanned: HandHistoryRow | null = null;
    while (scanned < maxScanned) {
      const rows = await this.store.listHandsForUserPage({
        userId,
        tableId: query.tableId,
        since: query.since,
        before,
        limit: batchSize,
      });
      for (const row of rows) {
        const result = parseResult(row.resultJson) as HandResultPayload | null;
        const matches =
          !!result &&
          isAnalyzableHand(result, userId, row.source) &&
          (!query.opponents || handOpponents(result, userId, row.source) === query.opponents);
        if (matches) {
          const next = visit(row, result);
          if (next === 'stop-before') return { exhausted: false, lastScanned, stoppedBefore: row };
          lastScanned = row;
          scanned += 1;
          if (next === 'stop-after') return { exhausted: false, lastScanned, stoppedBefore: null };
          continue;
        }
        lastScanned = row;
        scanned += 1;
      }
      if (rows.length < batchSize || !lastScanned) {
        return { exhausted: true, lastScanned, stoppedBefore: null };
      }
      before = new Date(lastScanned.startedAt).getTime();
    }
    return { exhausted: false, lastScanned, stoppedBefore: null };
  }

  listHandsForUsers(
    userIdA: string,
    userIdB: string,
    limit?: number,
  ): Promise<HandHistoryRow[]> {
    return this.store.listHandsForUsers(userIdA, userIdB, limit);
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

  async coachQuotaFor(
    userId: string,
    tableId?: string,
    now = new Date(),
  ): Promise<CoachQuota & { reviews: Record<string, string>; summary: string }> {
    const rows = await this.listCoachReviews(userId, utcCoachDay(now));
    const quota = coachQuota(rows, this.analysisDailyLimit());
    let stored = tableId ? (rows.find((r) => r.tableId === tableId)?.review ?? null) : null;
    if (tableId && !stored) stored = await this.latestCoachReviewText(userId, tableId);
    return { ...quota, reviews: reviewsFromStored(stored), summary: summaryFromStored(stored) };
  }

  private async latestCoachReviewText(userId: string, tableId: string): Promise<string | null> {
    if (typeof this.dataSource?.query !== 'function') return null;
    const res = await this.dataSource.query(
      `SELECT review FROM hand_coach_reviews
       WHERE user_id = $1 AND table_id = $2
       ORDER BY day DESC
       LIMIT 1`,
      [userId, tableId],
    );
    const rows = Array.isArray(res) ? (res as { review?: unknown }[]) : [];
    return typeof rows[0]?.review === 'string' ? rows[0].review : null;
  }

  /** Server setting only. Request bodies cannot raise this. */
  private analysisDailyLimit(): number {
    return clampAnalysisDailyLimit(this.siteConfig?.getRoomSettings().analysisDailyLimit);
  }

  async coachTable(userId: string, tableId: string, now = new Date()): Promise<CoachOutcome> {
    const day = utcCoachDay(now);
    const limit = this.analysisDailyLimit();
    const rows = await this.listCoachReviews(userId, day);
    const page = await this.listAnalysisHands(userId, { tableId, limit: 30 });
    try {
      return await runTableCoach({
        userId,
        tableId,
        day,
        hands: page.hands,
        truncated: page.nextBefore !== null,
        rows,
        limit,
        configured: !!this.chat && !this.chat.configurationError('cohere'),
        save: (row) => this.saveCoachReviewGuarded(row, limit),
        complete: (system, user) =>
          this.chat
            ? this.chat.completeCustom({ system, user, provider: 'cohere' })
            : Promise.resolve({ text: null, error: 'Coaching is not configured' }),
      });
    } catch (err) {
      if (!(err instanceof CoachSlotDenied)) throw err;
      const fresh = await this.listCoachReviews(userId, day);
      const quota = coachQuota(fresh, limit);
      return {
        ok: false,
        code: 'limit',
        message: `You can coach ${limit} tables a day. Try again tomorrow.`,
        ...quota,
      };
    }
  }

  private async listCoachReviews(userId: string, day: string): Promise<CoachReviewRow[]> {
    const res = await this.dataSource.query(
      `SELECT user_id as "userId", table_id as "tableId", day, hands_key as "handsKey", review
       FROM hand_coach_reviews WHERE user_id = $1 AND day = $2`,
      [userId, day],
    );
    return Array.isArray(res) ? (res as CoachReviewRow[]) : [];
  }

  private async saveCoachReview(row: CoachReviewRow): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO hand_coach_reviews (user_id, table_id, day, hands_key, review)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, table_id, day)
       DO UPDATE SET hands_key = EXCLUDED.hands_key, review = EXCLUDED.review, created_at = NOW()`,
      [row.userId, row.tableId, row.day, row.handsKey, row.review],
    );
  }

  /**
   * Counts this player's tables for the day under a lock, then inserts.
   * A second request cannot slip in between the count and the write.
   */
  private async saveCoachReviewGuarded(row: CoachReviewRow, limit: number): Promise<void> {
    const tx = this.dataSource?.transaction;
    if (typeof tx !== 'function') {
      await this.saveCoachReview(row);
      return;
    }
    const allowed = await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `coach:${row.userId}:${row.day}`,
      ]);
      const res = await manager.query(
        `SELECT table_id as "tableId" FROM hand_coach_reviews WHERE user_id = $1 AND day = $2`,
        [row.userId, row.day],
      );
      const ids = (Array.isArray(res) ? res : []).map((r: { tableId?: string }) => r.tableId);
      if (!ids.includes(row.tableId) && ids.length >= limit) return false;
      await manager.query(
        `INSERT INTO hand_coach_reviews (user_id, table_id, day, hands_key, review)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, table_id, day)
         DO UPDATE SET hands_key = EXCLUDED.hands_key, review = EXCLUDED.review, created_at = NOW()`,
        [row.userId, row.tableId, row.day, row.handsKey, row.review],
      );
      return true;
    });
    if (!allowed) throw new CoachSlotDenied();
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
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS hand_coach_reviews (
        user_id text NOT NULL,
        table_id text NOT NULL,
        day text NOT NULL,
        hands_key text NOT NULL,
        review text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, table_id, day)
      )
    `);
    // Invite codes are unique only among live rooms; history must allow reuse.
    await this.dataSource.query(
      `ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_invite_code_key`,
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
