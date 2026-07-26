import { randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';
import {
  applyAction,
  applyTimeout,
  cardToString,
  createEmptyTable,
  returnToWaiting,
  sitDown,
  standUp,
  startHand,
  topUp,
  toPrivateView,
  toPublicView,
  type EngineEvent,
  type HandState,
  type TableConfig,
} from '@poker/engine';
import type { KvStore } from './kv.js';
import type { HandHistoryStore } from './history.js';
import { chooseBotAction, isBotUserId, makeBotUserId, pickBotName } from './bot.js';

export interface TableMeta {
  id: string;
  inviteCode: string;
  name: string;
  hostUserId: string;
  isPrivate: boolean;
  config: TableConfig;
  createdAt: number;
}

export interface ConnectionContext {
  userId: string;
  name: string;
  send: (msg: unknown) => void;
}

type RateBucket = { count: number; resetAt: number };

export class Room {
  meta: TableMeta;
  state: HandState;
  private timers = new Map<string, NodeJS.Timeout>();
  private turnTimer: NodeJS.Timeout | null = null;
  private connections = new Map<string, ConnectionContext>(); // userId -> conn
  private spectators = new Set<string>();
  private rateLimits = new Map<string, RateBucket>();
  private kv: KvStore;
  private history: HandHistoryStore;
  private handStartedAt = 0;

  constructor(meta: TableMeta, kv: KvStore, history: HandHistoryStore) {
    this.meta = meta;
    this.state = createEmptyTable(meta.config);
    this.kv = kv;
    this.history = history;
  }

  get config(): TableConfig {
    return this.meta.config;
  }

  attach(conn: ConnectionContext): void {
    this.connections.set(conn.userId, conn);
    this.spectators.add(conn.userId);
    this.pushTo(conn.userId);
  }

  detach(userId: string): void {
    this.connections.delete(userId);
    this.spectators.delete(userId);
  }

  private rateLimit(userId: string, max = 20, windowMs = 5000): boolean {
    const now = Date.now();
    let b = this.rateLimits.get(userId);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      this.rateLimits.set(userId, b);
    }
    b.count += 1;
    return b.count <= max;
  }

  private seatOf(userId: string): number | null {
    const p = this.state.players.find((x) => x.userId === userId);
    return p ? p.seat : null;
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private armTurnTimer(): void {
    this.clearTurnTimer();
    if (this.state.toAct === null) return;
    if (
      this.state.street === 'waiting' ||
      this.state.street === 'payout' ||
      this.state.street === 'showdown'
    ) {
      return;
    }

    const seat = this.state.toAct;
    const actor = this.state.players[seat];
    if (actor && isBotUserId(actor.userId)) {
      const delay = 650 + Math.floor(Math.random() * 1400);
      this.turnTimer = setTimeout(() => this.runBotTurn(seat), delay);
      return;
    }

    this.turnTimer = setTimeout(() => {
      const result = applyTimeout(this.state, this.config);
      if (result.ok) {
        this.state = result.state;
        this.announceEngineEvents(result.events);
        void this.afterStateChange();
      }
    }, this.config.turnTimeMs);
  }

  private runBotTurn(seat: number): void {
    if (this.state.toAct !== seat) return;
    const actor = this.state.players[seat];
    if (!actor || !isBotUserId(actor.userId)) return;

    const intent = chooseBotAction(this.state, seat, this.config);
    if (!intent) return;

    const result = applyAction(this.state, seat, intent, this.config);
    if (!result.ok) {
      // Safety: never stall the hand
      const fallback = applyTimeout(this.state, this.config);
      if (fallback.ok) {
        this.state = fallback.state;
        this.announceEngineEvents(fallback.events);
        void this.afterStateChange();
      }
      return;
    }
    this.state = result.state;
    this.announceEngineEvents(result.events);
    void this.afterStateChange();
  }

  addBot(
    _requestedBy: string,
    seat?: number,
    buyIn?: number,
  ): { ok: boolean; error?: string } {
    if (this.state.street !== 'waiting' && this.state.street !== 'payout') {
      return { ok: false, error: 'Add bots between hands' };
    }
    if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }

    const emptySeats = this.state.players.filter((p) => p.status === 'empty').map((p) => p.seat);
    if (emptySeats.length === 0) return { ok: false, error: 'Table full' };

    const target =
      seat !== undefined && emptySeats.includes(seat) ? seat : emptySeats[0]!;
    const amount = buyIn ?? this.config.minBuyIn;
    if (amount < this.config.minBuyIn || amount > this.config.maxBuyIn) {
      return { ok: false, error: 'Buy-in out of range' };
    }

    const taken = new Set(
      this.state.players.filter((p) => p.name).map((p) => p.name!),
    );
    const name = pickBotName(taken);
    const userId = makeBotUserId(nanoid(8));
    const result = sitDown(this.state, target, userId, name, amount);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.systemChat('Dealer', `${name} joins as a bot (seat ${target})`);
    void this.afterStateChange();
    this.maybeAutoStart();
    return { ok: true };
  }

  removeBot(seat: number): { ok: boolean; error?: string } {
    const p = this.state.players[seat];
    if (!p || !isBotUserId(p.userId)) return { ok: false, error: 'Not a bot seat' };
    if (this.state.street !== 'waiting' && this.state.street !== 'payout') {
      return { ok: false, error: 'Remove bots between hands' };
    }
    if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }
    const name = p.name ?? 'Bot';
    const result = standUp(this.state, seat);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.systemChat('Dealer', `${name} leaves the table`);
    void this.afterStateChange();
    return { ok: true };
  }

  private async persist(): Promise<void> {
    const snapshot = {
      meta: this.meta,
      // Never persist undealt deck / hole cards to Redis in MVP public logs —
      // for reconnect we keep a server-local snapshot only via memory.
      version: this.state.version,
      street: this.state.street,
      pot: this.state.pot,
      public: toPublicView(this.meta.id, this.state, this.config),
    };
    await this.kv.set(`table:${this.meta.id}`, JSON.stringify(snapshot), 3600);
    await this.kv.publish(`table:${this.meta.id}:events`, JSON.stringify({ version: this.state.version }));
  }

  private pushTo(userId: string): void {
    const conn = this.connections.get(userId);
    if (!conn) return;
    const seat = this.seatOf(userId);
    const table = toPublicView(this.meta.id, this.state, this.config);
    const priv = seat !== null ? toPrivateView(this.state, seat, this.config) : null;
    conn.send({ type: 'state_sync', table, private: priv });
  }

  broadcast(): void {
    for (const userId of this.connections.keys()) {
      this.pushTo(userId);
    }
  }

  private async afterStateChange(): Promise<void> {
    if (this.state.street === 'payout') {
      await this.history.recordHand({
        tableId: this.meta.id,
        handId: this.state.handId,
        startedAt: this.handStartedAt,
        endedAt: Date.now(),
        result: {
          winners: this.state.winners,
          community: this.state.community,
          players: this.state.players.map((p) => ({
            seat: p.seat,
            userId: p.userId,
            name: p.name,
            stack: p.stack,
            revealed: p.revealed,
            holeCards: p.revealed && p.holeCards ? p.holeCards : null,
          })),
        },
      });
      // Brief pause then waiting
      setTimeout(() => {
        if (this.state.street === 'payout') {
          this.state = returnToWaiting(this.state);
          this.broadcast();
          void this.persist();
          // Auto-start next hand if enough players
          this.maybeAutoStart();
        }
      }, 2500);
    }
    this.armTurnTimer();
    this.broadcast();
    await this.persist();
  }

  maybeAutoStart(): void {
    if (this.state.street !== 'waiting') return;
    const ready = this.state.players.filter((p) => p.userId && p.stack > 0).length;
    if (ready >= 2) {
      // Small delay so clients see waiting state
      setTimeout(() => {
        if (this.state.street === 'waiting') {
          void this.startHand(this.meta.hostUserId);
        }
      }, 1500);
    }
  }

  sit(userId: string, name: string, seat: number, buyIn: number): { ok: boolean; error?: string } {
    if (!this.rateLimit(userId)) return { ok: false, error: 'Rate limited' };
    if (buyIn < this.config.minBuyIn || buyIn > this.config.maxBuyIn) {
      return { ok: false, error: 'Buy-in out of range' };
    }
    const result = sitDown(this.state, seat, userId, name, buyIn);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    void this.afterStateChange();
    this.maybeAutoStart();
    return { ok: true };
  }

  stand(userId: string, seat: number): { ok: boolean; error?: string } {
    if (this.seatOf(userId) !== seat) return { ok: false, error: 'Not your seat' };
    const result = standUp(this.state, seat);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    void this.afterStateChange();
    return { ok: true };
  }

  doTopUp(userId: string, seat: number, amount: number): { ok: boolean; error?: string } {
    if (this.seatOf(userId) !== seat) return { ok: false, error: 'Not your seat' };
    const result = topUp(this.state, seat, amount, this.config.maxBuyIn);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    void this.afterStateChange();
    return { ok: true };
  }

  startHand(userId: string): { ok: boolean; error?: string } {
    if (userId !== this.meta.hostUserId) {
      // Allow any seated player to start for casual home games
      if (this.seatOf(userId) === null) return { ok: false, error: 'Not seated' };
    }
    if (this.state.street !== 'waiting' && this.state.street !== 'payout') {
      return { ok: false, error: 'Hand in progress' };
    }
    if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }
    const handId = nanoid(10);
    this.handStartedAt = Date.now();
    const result = startHand(this.state, this.config, handId, (n) => randomBytes(n));
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.announceEngineEvents(result.events);
    void this.afterStateChange();
    return { ok: true };
  }

  action(
    userId: string,
    handId: string,
    seq: number,
    type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin',
    amount?: number,
  ): { ok: boolean; error?: string } {
    if (!this.rateLimit(userId, 30, 5000)) return { ok: false, error: 'Rate limited' };
    const seat = this.seatOf(userId);
    if (seat === null) return { ok: false, error: 'Not seated' };
    if (this.state.handId !== handId) return { ok: false, error: 'Wrong hand' };
    if (this.state.toAct !== seat) return { ok: false, error: 'Not your turn' };

    const result = applyAction(this.state, seat, { type, amount, seq }, this.config);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.announceEngineEvents(result.events);
    void this.afterStateChange();
    return { ok: true };
  }

  private announceEngineEvents(events: EngineEvent[]): void {
    for (const e of events) {
      if (e.type === 'action') {
        const p = this.state.players[e.seat];
        const name = p?.name ?? `Seat ${e.seat}`;
        this.systemChat(name, formatActionLine(e.action, e.amount));
      } else if (e.type === 'street') {
        const label = e.street.charAt(0).toUpperCase() + e.street.slice(1);
        this.systemChat('Dealer', `${label} — ${e.cards.map(cardToString).join(' ')}`);
      } else if (e.type === 'hand_ended') {
        if (e.winners.length === 1) {
          const w = e.winners[0]!;
          const name = this.state.players[w.seat]?.name ?? `Seat ${w.seat}`;
          const hand = w.handName ? ` with ${w.handName}` : '';
          this.systemChat('Dealer', `${name} wins ${w.amount}${hand}`);
        } else if (e.winners.length > 1) {
          const parts = e.winners.map((w) => {
            const name = this.state.players[w.seat]?.name ?? `Seat ${w.seat}`;
            const hand = w.handName ? ` (${w.handName})` : '';
            return `${name} ${w.amount}${hand}`;
          });
          this.systemChat('Dealer', `Split pot — ${parts.join(', ')}`);
        }
      } else if (e.type === 'blinds_posted') {
        const sb = this.state.players[e.sbSeat]?.name ?? `Seat ${e.sbSeat}`;
        const bb = this.state.players[e.bbSeat]?.name ?? `Seat ${e.bbSeat}`;
        this.systemChat('Dealer', `Blinds — ${sb} posts ${e.sb}, ${bb} posts ${e.bb}`);
      }
    }
  }

  private systemChat(name: string, text: string): void {
    const msg = {
      type: 'chat',
      tableId: this.meta.id,
      userId: 'system',
      name,
      text,
      at: Date.now(),
    };
    for (const conn of this.connections.values()) conn.send(msg);
  }

  chat(userId: string, name: string, text: string): void {
    if (!this.rateLimit(userId, 10, 5000)) return;
    const msg = { type: 'chat', tableId: this.meta.id, userId, name, text, at: Date.now() };
    for (const conn of this.connections.values()) conn.send(msg);
  }

  emoji(userId: string, name: string, emoji: string): void {
    if (!this.rateLimit(userId, 15, 5000)) return;
    const msg = { type: 'emoji', tableId: this.meta.id, userId, name, emoji, at: Date.now() };
    for (const conn of this.connections.values()) conn.send(msg);
  }
}

function formatActionLine(
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin',
  amount: number,
): string {
  switch (action) {
    case 'fold':
      return 'folds';
    case 'check':
      return 'checks';
    case 'call':
      return `calls ${amount}`;
    case 'bet':
      return `bets ${amount}`;
    case 'raise':
      return `raises to ${amount}`;
    case 'allin':
      return amount > 0 ? `goes all-in (${amount})` : 'goes all-in';
    default:
      return action;
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private byInvite = new Map<string, string>();
  private kv: KvStore;
  private history: HandHistoryStore;

  constructor(kv: KvStore, history: HandHistoryStore) {
    this.kv = kv;
    this.history = history;
  }

  create(opts: {
    name: string;
    hostUserId: string;
    config: TableConfig;
    isPrivate: boolean;
  }): TableMeta {
    const id = nanoid(10);
    const inviteCode = nanoid(8);
    const meta: TableMeta = {
      id,
      inviteCode,
      name: opts.name,
      hostUserId: opts.hostUserId,
      isPrivate: opts.isPrivate,
      config: opts.config,
      createdAt: Date.now(),
    };
    const room = new Room(meta, this.kv, this.history);
    this.rooms.set(id, room);
    this.byInvite.set(inviteCode, id);
    void this.history.recordTable(meta);
    return meta;
  }

  get(tableId: string): Room | undefined {
    return this.rooms.get(tableId);
  }

  getByInvite(code: string): Room | undefined {
    const id = this.byInvite.get(code);
    return id ? this.rooms.get(id) : undefined;
  }

  listPublic(): TableMeta[] {
    return [...this.rooms.values()]
      .filter((r) => !r.meta.isPrivate)
      .map((r) => r.meta);
  }
}
