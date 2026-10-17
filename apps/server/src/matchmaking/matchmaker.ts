import { DEFAULT_STAKE_ID, stakeById, type StakePreset } from '@poker/protocol';
import type { Room, RoomManager } from '../rooms/room.js';
import type {
  BotSeatingConfig,
  PublicTableTimingsMs,
} from '../site-config/site-config.types.js';
import {
  MATCHMADE_HOST_USER_ID,
  MATCHMADE_MAX_SEATS,
  MATCHMADE_RESERVATION_MS,
  MATCHMADE_TABLE_NAME,
  MATCHMADE_TARGET_PLAYERS,
} from './matchmaking.constants.js';

export interface MatchmakerDeps {
  rooms: RoomManager;
  /** Current admin timings; read whenever a timer is armed or a table is formed. */
  timings: () => PublicTableTimingsMs;
  botSeating: () => BotSeatingConfig;
  sendToUser: (userId: string, msg: unknown) => void;
  now?: () => number;
}

type QueueEntry = { name: string; queuedAt: number };

function resolveStake(stakeId: string | undefined): StakePreset {
  return (stakeId && stakeById(stakeId)) || stakeById(DEFAULT_STAKE_ID)!;
}

/**
 * Public poker queue, one per stake preset: groups waiting players onto a fresh matchmade
 * table, backfills open seats on live ones of the same stake, and tops new tables up with
 * bots once the oldest entry has waited `botFillMs`.
 */
export class Matchmaker {
  /** stakeId → FIFO queue. A user waits in at most one stake queue. */
  private readonly queues = new Map<string, Map<string, QueueEntry>>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** tableId → userId → reservation expiry (matched but not seated yet). */
  private readonly reservations = new Map<string, Map<string, number>>();
  private readonly now: () => number;

  constructor(private readonly deps: MatchmakerDeps) {
    this.now = deps.now ?? Date.now;
  }

  isQueued(userId: string): boolean {
    return this.queuedStake(userId) !== null;
  }

  queueSize(stakeId?: string): number {
    if (stakeId !== undefined) return this.queues.get(stakeId)?.size ?? 0;
    let n = 0;
    for (const q of this.queues.values()) n += q.size;
    return n;
  }

  join(userId: string, name: string, requestedStakeId?: string): void {
    const stake = resolveStake(requestedStakeId);

    const seatedAt = this.deps.rooms.listMatchmade().find((r) => r.isSeated(userId));
    if (seatedAt) {
      this.leaveQueue(userId);
      this.sendFound(userId, seatedAt);
      return;
    }

    const reservedAt = this.reservedTableFor(userId);
    if (reservedAt) {
      this.sendFound(userId, reservedAt);
      return;
    }

    const current = this.queuedStake(userId);
    if (current === stake.id) {
      this.sendStatus(stake.id, userId);
      return;
    }
    if (current !== null) this.leaveQueue(userId);

    const open = this.findBackfillTable(stake.id);
    if (open) {
      this.reserve(open, userId);
      this.sendFound(userId, open);
      return;
    }

    const queue = this.queueFor(stake.id);
    queue.set(userId, { name, queuedAt: this.now() });
    if (queue.size >= MATCHMADE_MAX_SEATS) {
      this.formTable(stake);
      return;
    }
    this.armTimer(stake.id);
    this.broadcastStatus(stake.id);
  }

  /** Returns true when the user was waiting in a queue. */
  cancel(userId: string): boolean {
    if (!this.leaveQueue(userId)) return false;
    this.deps.sendToUser(userId, { type: 'matchmaking_cancelled' });
    return true;
  }

  dispose(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.queues.clear();
    this.reservations.clear();
  }

  private queueFor(stakeId: string): Map<string, QueueEntry> {
    let q = this.queues.get(stakeId);
    if (!q) {
      q = new Map();
      this.queues.set(stakeId, q);
    }
    return q;
  }

  private queuedStake(userId: string): string | null {
    for (const [stakeId, q] of this.queues) {
      if (q.has(userId)) return stakeId;
    }
    return null;
  }

  /** Drop the user from whichever queue holds them and refresh that queue. */
  private leaveQueue(userId: string): boolean {
    const stakeId = this.queuedStake(userId);
    if (stakeId === null) return false;
    this.queues.get(stakeId)!.delete(userId);
    this.armTimer(stakeId);
    this.broadcastStatus(stakeId);
    return true;
  }

  private botFillAt(stakeId: string): number | null {
    const oldest = this.queues.get(stakeId)?.values().next().value as QueueEntry | undefined;
    if (!oldest) return null;
    return oldest.queuedAt + this.deps.timings().botFillMs;
  }

  private armTimer(stakeId: string): void {
    const existing = this.timers.get(stakeId);
    if (existing) clearTimeout(existing);
    this.timers.delete(stakeId);
    const at = this.botFillAt(stakeId);
    if (at === null) {
      this.queues.delete(stakeId);
      return;
    }
    this.timers.set(
      stakeId,
      setTimeout(() => {
        this.timers.delete(stakeId);
        this.formTable(resolveStake(stakeId));
      }, Math.max(0, at - this.now())),
    );
  }

  private formTable(stake: StakePreset): void {
    const queue = this.queues.get(stake.id);
    const taken = queue ? [...queue.entries()].slice(0, MATCHMADE_MAX_SEATS) : [];
    if (taken.length === 0) return;
    for (const [userId] of taken) queue!.delete(userId);

    const timings = this.deps.timings();
    const meta = this.deps.rooms.create({
      name: MATCHMADE_TABLE_NAME,
      hostUserId: MATCHMADE_HOST_USER_ID,
      isPrivate: false,
      matchmade: true,
      stakeId: stake.id,
      timings,
      config: {
        maxSeats: MATCHMADE_MAX_SEATS,
        smallBlind: stake.smallBlind,
        bigBlind: stake.bigBlind,
        buyIn: stake.buyIn,
        turnTimeMs: timings.turnMs,
      },
    });
    const room = this.deps.rooms.get(meta.id)!;
    const bots = Math.max(0, MATCHMADE_TARGET_PLAYERS - taken.length);
    if (bots > 0) {
      const seating = this.deps.botSeating();
      room.seatSystemBots(bots, seating.names, seating);
    }
    for (const [userId] of taken) {
      this.reserve(room, userId);
      this.sendFound(userId, room);
    }

    this.armTimer(stake.id);
    this.broadcastStatus(stake.id);
  }

  /** Oldest live table of this stake with a human present and a seat not held for an arrival. */
  private findBackfillTable(stakeId: string): Room | null {
    for (const room of this.deps.rooms.listMatchmade()) {
      if (room.meta.stakeId !== stakeId) continue;
      if (!room.hasHumanPresence()) continue;
      if (room.emptySeatCount() - this.pendingArrivals(room) > 0) return room;
    }
    return null;
  }

  private pendingArrivals(room: Room): number {
    const held = this.reservations.get(room.meta.id);
    if (!held) return 0;
    const now = this.now();
    for (const [userId, expiresAt] of held) {
      if (expiresAt <= now || room.isSeated(userId)) held.delete(userId);
    }
    if (held.size === 0) this.reservations.delete(room.meta.id);
    return held.size;
  }

  private reservedTableFor(userId: string): Room | null {
    const now = this.now();
    for (const [tableId, held] of this.reservations) {
      const expiresAt = held.get(userId);
      if (expiresAt === undefined || expiresAt <= now) continue;
      const room = this.deps.rooms.get(tableId);
      if (room && !room.isClosed()) return room;
    }
    return null;
  }

  private reserve(room: Room, userId: string): void {
    let held = this.reservations.get(room.meta.id);
    if (!held) {
      held = new Map();
      this.reservations.set(room.meta.id, held);
    }
    held.set(userId, this.now() + MATCHMADE_RESERVATION_MS);
  }

  private sendFound(userId: string, room: Room): void {
    this.deps.sendToUser(userId, {
      type: 'matchmaking_found',
      tableId: room.meta.id,
      inviteCode: room.meta.inviteCode,
    });
  }

  private sendStatus(stakeId: string, userId: string): void {
    const queue = this.queues.get(stakeId);
    const entry = queue?.get(userId);
    const botFillAt = this.botFillAt(stakeId);
    if (!queue || !entry || botFillAt === null) return;
    this.deps.sendToUser(userId, {
      type: 'matchmaking_status',
      status: 'searching',
      stakeId,
      queuedAt: entry.queuedAt,
      botFillAt,
      humansWaiting: queue.size,
    });
  }

  private broadcastStatus(stakeId: string): void {
    const queue = this.queues.get(stakeId);
    if (!queue) return;
    for (const userId of queue.keys()) this.sendStatus(stakeId, userId);
  }
}
