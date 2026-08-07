/**
 * Schema definitions for PostgreSQL (Drizzle).
 * MVP can also use the file-backed store in the server when DATABASE_URL is unset.
 */
export interface UserRow {
  id: string;
  name: string;
  username: string | null;
  usernameLower: string | null;
  passwordHash: string | null;
  avatarId: number;
  createdAt: Date;
}

export interface TableRowRow {
  id: string;
  inviteCode: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  turnTimeMs: number;
  maxSeats: number;
  isPrivate: boolean;
  hostUserId: string;
  createdAt: Date;
}

export interface HandHistoryRow {
  id: string;
  tableId: string;
  handId: string;
  startedAt: Date;
  endedAt: Date | null;
  /** JSON snapshot of public hand result (no undealt/unused deck). */
  resultJson: string;
}

export interface ChipLedgerRow {
  id: string;
  userId: string;
  tableId: string;
  delta: number;
  reason: 'buy_in' | 'cash_out' | 'top_up' | 'hand_win' | 'hand_loss';
  createdAt: Date;
}

/** SQL DDL for Postgres bootstrap. */
export const POSTGRES_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT,
  username_lower TEXT,
  password_hash TEXT,
  avatar_id INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx
  ON users (username_lower) WHERE username_lower IS NOT NULL;


CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  small_blind INT NOT NULL,
  big_blind INT NOT NULL,
  min_buy_in INT NOT NULL,
  max_buy_in INT NOT NULL,
  turn_time_ms INT NOT NULL,
  max_seats INT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT TRUE,
  host_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hand_history (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES tables(id),
  hand_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  result_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chip_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  table_id TEXT NOT NULL,
  delta INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hand_history_table_idx ON hand_history(table_id);
CREATE INDEX IF NOT EXISTS chip_ledger_user_idx ON chip_ledger(user_id);
`;
