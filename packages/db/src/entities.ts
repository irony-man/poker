import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
@Index('users_username_lower_uidx', ['usernameLower'], {
  unique: true,
  where: 'username_lower IS NOT NULL',
})
export class UserEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  username!: string | null;

  @Column({ name: 'username_lower', type: 'text', nullable: true })
  usernameLower!: string | null;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'avatar_id', type: 'int', default: 0 })
  avatarId!: number;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  /** Viewer table felt theme preset (0–8). */
  @Column({ name: 'table_color_id', type: 'int', default: 0 })
  tableColorId!: number;

  /** App chrome look: Classic (`v1`) or Arcade (`v2`). */
  @Column({ name: 'ui_theme', type: 'text', default: 'v1' })
  uiTheme!: string;

  /** Table layout: Classic oval (`v1`) or stacked HUD (`v2`). */
  @Column({ name: 'table_layout', type: 'text', default: 'v1' })
  tableLayout!: string;

  /** Viewer mute for table SFX. */
  @Column({ name: 'sfx_muted', type: 'boolean', default: false })
  sfxMuted!: boolean;

  @Column({ name: 'chip_balance', type: 'int', default: 10_000 })
  chipBalance!: number;

  /** Contest ranking rating (Whuffies); not spendable bankroll. */
  @Column({ name: 'whuffie_balance', type: 'int', default: 0 })
  whuffieBalance!: number;

  /** Completed online hands this user was dealt into. */
  @Column({ name: 'hands_played', type: 'int', default: 0 })
  handsPlayed!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'auth_sessions' })
@Index('auth_sessions_user_idx', ['userId'])
@Index('auth_sessions_expires_idx', ['expiresAt'])
export class AuthSessionEntity {
  @PrimaryColumn({ type: 'text' })
  token!: string;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}

@Entity({ name: 'auth_tickets' })
@Index('auth_tickets_user_idx', ['userId'])
@Index('auth_tickets_expires_idx', ['expiresAt'])
export class AuthTicketEntity {
  @PrimaryColumn({ type: 'text' })
  ticket!: string;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;
}

@Entity({ name: 'tables' })
export class TableEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'invite_code', type: 'text', unique: true })
  inviteCode!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'small_blind', type: 'int' })
  smallBlind!: number;

  @Column({ name: 'big_blind', type: 'int' })
  bigBlind!: number;

  @Column({ name: 'min_buy_in', type: 'int' })
  minBuyIn!: number;

  @Column({ name: 'max_buy_in', type: 'int' })
  maxBuyIn!: number;

  @Column({ name: 'turn_time_ms', type: 'int' })
  turnTimeMs!: number;

  @Column({ name: 'max_seats', type: 'int' })
  maxSeats!: number;

  @Column({ name: 'is_private', type: 'boolean', default: true })
  isPrivate!: boolean;

  @Column({ name: 'host_user_id', type: 'text' })
  hostUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

export type HandHistorySource = 'online' | 'offline';
export type ChatMessageKind = 'user' | 'system' | 'emoji';

@Entity({ name: 'hand_history' })
@Index('hand_history_table_idx', ['tableId'])
@Index('hand_history_contest_idx', ['contestId'])
export class HandHistoryEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'table_id', type: 'text' })
  tableId!: string;

  @ManyToOne(() => TableEntity)
  @JoinColumn({ name: 'table_id' })
  table?: TableEntity;

  @Column({ name: 'hand_id', type: 'text' })
  handId!: string;

  @Column({ name: 'contest_id', type: 'text', nullable: true })
  contestId!: string | null;

  @Column({ name: 'source', type: 'text', default: 'online' })
  source!: HandHistorySource;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'result_json', type: 'text' })
  resultJson!: string;
}

@Entity({ name: 'chat_messages' })
@Index('chat_messages_table_at_idx', ['tableId', 'at'])
@Index('chat_messages_contest_at_idx', ['contestId', 'at'])
export class ChatMessageEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'table_id', type: 'text' })
  tableId!: string;

  @Column({ name: 'contest_id', type: 'text', nullable: true })
  contestId!: string | null;

  @Column({ name: 'hand_id', type: 'text', nullable: true })
  handId!: string | null;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'timestamptz' })
  at!: Date;

  @Column({ type: 'text' })
  kind!: ChatMessageKind;

  @Column({ type: 'text', default: 'online' })
  source!: HandHistorySource;
}

export type ChipLedgerReason =
  | 'signup_grant'
  | 'free_refill'
  | 'buy_in'
  | 'cash_out'
  | 'top_up'
  | 'hand_win'
  | 'hand_loss'
  | 'admin_credit'
  | 'admin_reset';

@Entity({ name: 'chip_ledger' })
@Index('chip_ledger_user_idx', ['userId'])
export class ChipLedgerEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'user_id', type: 'text' })
  userId!: string;

  @Column({ name: 'table_id', type: 'text' })
  tableId!: string;

  @Column({ type: 'int' })
  delta!: number;

  @Column({ type: 'text' })
  reason!: ChipLedgerReason;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'table_chip_balances' })
@Index('table_chip_balances_table_idx', ['tableId'])
export class TableChipBalanceEntity {
  @PrimaryColumn({ name: 'user_id', type: 'text' })
  userId!: string;

  @PrimaryColumn({ name: 'table_id', type: 'text' })
  tableId!: string;

  @Column({ type: 'int' })
  stack!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'social_store' })
export class SocialStoreEntity {
  @PrimaryColumn({ type: 'text', default: 'default' })
  id!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/** Single-row site settings (announcement + economy) for admin panel. */
@Entity({ name: 'site_config' })
export class SiteConfigEntity {
  @PrimaryColumn({ type: 'text', default: 'default' })
  id!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

/** All TypeORM entities registered by the server. */
export const ALL_ENTITIES = [
  UserEntity,
  AuthSessionEntity,
  AuthTicketEntity,
  TableEntity,
  HandHistoryEntity,
  ChatMessageEntity,
  ChipLedgerEntity,
  TableChipBalanceEntity,
  SocialStoreEntity,
  SiteConfigEntity,
] as const;
