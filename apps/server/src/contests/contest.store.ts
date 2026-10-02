import type {
  ContestEntrant,
  ContestMode,
  ContestPendingInvite,
  ContestPlacement,
  ContestStatus,
} from '@poker/protocol';
import type { Queryable } from '../database/queryable.js';

/** JSON-safe contest snapshot (Maps/Sets flattened). */
export interface PersistedContest {
  v: 1;
  id: string;
  inviteCode: string;
  name: string;
  mode: ContestMode;
  status: ContestStatus;
  hostUserId: string;
  fieldSize: number;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  turnTimeMs: number;
  isPrivate: boolean;
  autoStart: boolean;
  handLimit: number | null;
  handsPlayed: number;
  entrants: (ContestEntrant & { isBot: boolean })[];
  pendingInvites: ContestPendingInvite[];
  placements: ContestPlacement[];
  tableId: string | null;
  levelIndex: number;
  handsAtLevel: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  activeTableByUser: [string, string][];
  tableIds: string[];
  entryPaid: string[];
  walletSettled: string[];
  prizeSettled: string[];
  /** userId → stack after the last finished hand / top-up (running contests). */
  lastStacks: Record<string, number>;
}

export interface ContestPersistence {
  loadAll(): Promise<PersistedContest[]>;
  save(contest: PersistedContest): Promise<void>;
}

/** Finished contests older than this are not loaded back into memory on boot. */
const FINISHED_RETENTION_DAYS = 30;

export class PostgresContestStore implements ContestPersistence {
  private ready: Promise<void> | null = null;

  constructor(private readonly pool: Queryable) {}

  private ensureSchema(): Promise<void> {
    this.ready ??= (async () => {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS contests (
          id text PRIMARY KEY,
          status text NOT NULL,
          payload jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `);
      await this.pool.query(
        `CREATE INDEX IF NOT EXISTS contests_status_idx ON contests (status)`,
      );
    })();
    return this.ready;
  }

  async loadAll(): Promise<PersistedContest[]> {
    await this.ensureSchema();
    const res = await this.pool.query(
      `SELECT payload FROM contests
       WHERE status IN ('registering', 'running')
          OR created_at > NOW() - ($1::int * INTERVAL '1 day')
       ORDER BY created_at ASC`,
      [FINISHED_RETENTION_DAYS],
    );
    return res.rows
      .map((row) => (row as { payload?: PersistedContest }).payload)
      .filter((p): p is PersistedContest => Boolean(p && p.id && p.v === 1));
  }

  async save(contest: PersistedContest): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `INSERT INTO contests (id, status, payload, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, to_timestamp($4 / 1000.0), NOW())
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         payload = EXCLUDED.payload,
         updated_at = NOW()`,
      [contest.id, contest.status, JSON.stringify(contest), contest.createdAt],
    );
  }
}
