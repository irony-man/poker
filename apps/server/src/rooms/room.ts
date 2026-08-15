import { randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';
import {
  applyAction,
  applyTimeout,
  cardToString,
  createEmptyTable,
  returnToWaiting,
  sitDown,
  sitIn,
  sitOut,
  standUp,
  leaveSeat,
  startHand,
  topUp,
  toPrivateView,
  toPublicView,
  type EngineEvent,
  type HandState,
  type TableConfig,
} from '@poker/engine';
import type { KvStore } from '../kv/kv.store.js';
import type { HandHistoryStore } from '../history/history.store.js';
import type { TableChipStore } from '../table-chips/table-chips.store.js';
import { MemoryTableChipStore } from '../table-chips/table-chips.store.js';
import { avatarIdFromUserId, clampAvatarId } from '../avatars.js';
import { chooseBotAction, isBotUserId, makeBotUserId, pickBotName, resolveBotPersonalityId } from '../bot.js';
import type { BotStyleOptions } from '@poker/engine';
import type { WalletStore } from '../wallet/wallet.constants.js';
import { UnlimitedWalletStore, WalletError } from '../wallet/wallet.store.js';

export interface TournamentTableRules {
  contestId: string;
  mode: 'rounds' | 'chips';
  /** When true, no more hands will be dealt on this table. */
  frozen?: boolean;
  /** Rounds contests allow rebuys to the table buy-in. */
  allowTopUp?: boolean;
  /** Completed hands (updated after each hand ends). */
  handsPlayed?: number;
  /** Fixed hand budget for rounds mode; null/undefined for freezeouts. */
  handLimit?: number | null;
}

export interface TableMeta {
  id: string;
  inviteCode: string;
  name: string;
  hostUserId: string;
  isPrivate: boolean;
  /** Links public ring tables to a stake preset id. */
  stakeId?: string;
  config: TableConfig;
  createdAt: number;
  /** Present when this room is owned by a tournament contest. */
  tournament?: TournamentTableRules;
  /**
   * Sticky free-play: human buy-in / top-up / cash-out do not touch the wallet.
   * Private host + bots only — never public stake or tournament tables.
   */
  playMoney?: boolean;
}

/** Called after a tournament table hand reaches payout (before next-hand scheduling). */
export type TournamentHandEndedHook = (room: Room) => void;

export interface ConnectionContext {
  userId: string;
  name: string;
  avatarId: number;
  avatarUrl: string | null;
  send: (msg: unknown) => void;
}

type RateBucket = { count: number; resetAt: number };

/** Keep seated players through brief disconnects; vacate if they don't reconnect in time. */
const DISCONNECT_GRACE_MS = 120_000;

/** Close cash/public rooms with no humans after this long. Tournament tables are exempt. */
export const ROOM_INACTIVITY_MS = 15 * 60 * 1000;
/** How often RoomManager checks idle rooms. */
export const ROOM_IDLE_SWEEP_MS = 30_000;

export class Room {
  meta: TableMeta;
  state: HandState;
  private timers = new Map<string, NodeJS.Timeout>();
  private turnTimer: NodeJS.Timeout | null = null;
  /** Epoch ms when the current human turn expires; null for bots / idle. */
  private turnEndsAt: number | null = null;
  private connections = new Map<string, ConnectionContext>(); // userId -> conn
  private spectators = new Set<string>();
  private disconnectTimers = new Map<string, NodeJS.Timeout>();
  private rateLimits = new Map<string, RateBucket>();
  /** Users in the table voice channel (userId → display name). */
  private voiceParticipants = new Map<string, string>();
  /** Preset avatar index per seated/connected user (incl. bots). */
  private avatarByUser = new Map<string, number>();
  private avatarUrlByUser = new Map<string, string>();
  /** Cash: humans who have opted in for the next hand. */
  private readyUserIds = new Set<string>();
  /** Bots that have auto-readied for the next hand (UI; deal gating treats all bots as ready). */
  private botReadyUserIds = new Set<string>();
  private botReadyTimers = new Map<string, NodeJS.Timeout>();
  /** Cash: sit out after the current hand finishes (still finish this hand). */
  private pendingSitOutUserIds = new Set<string>();
  private kv: KvStore;
  private history: HandHistoryStore;
  private chips: TableChipStore;
  private wallet: WalletStore;
  private handStartedAt = 0;
  private tournamentHook: TournamentHandEndedHook | null = null;
  private autoStartTimer: NodeJS.Timeout | null = null;
  /** Tournament: one hand → payout transition already notified. */
  private lastNotifiedHandId: string | null = null;
  /** History: one hand → payout already persisted. */
  private lastRecordedHandId: string | null = null;
  private handActions: Array<EngineEvent & { at: number }> = [];
  private handChat: Array<{ at: number; userId: string; name: string; text: string }> = [];
  /**
   * Epoch ms when the table last became free of humans (connected, seated, or disconnect-grace).
   * Null while any human is present. Set at create when empty.
   */
  private idleSince: number | null = null;
  private closed = false;
  /** Serialize buy-in sits so autoSit + client sit cannot interleave across awaits. */
  private sitChain: Promise<void> = Promise.resolve();
  /** Fired when public table seated count changes (lobby push). */
  private onSeatingChange: (() => void) | null = null;
  private lastLobbySeats = -1;
  /** Name pool from an admin bot group; sticks for later seats on this table. */
  private botNamePool: string[] | null = null;
  /** Style map from an admin bot group; sticks with the name pool. */
  private botStyles: BotStyleOptions | null = null;

  /** Resolved name pool used for bots on this room (or null if not set). */
  getBotNamePool(): string[] | null {
    return this.botNamePool ? [...this.botNamePool] : null;
  }

  getBotStyles(): BotStyleOptions | null {
    return this.botStyles
      ? {
          defaultPersonality: this.botStyles.defaultPersonality ?? null,
          namePersonalities: { ...(this.botStyles.namePersonalities ?? {}) },
        }
      : null;
  }

  constructor(
    meta: TableMeta,
    kv: KvStore,
    history: HandHistoryStore,
    tournamentHook: TournamentHandEndedHook | null = null,
    chips: TableChipStore = new MemoryTableChipStore(),
    wallet: WalletStore = new UnlimitedWalletStore(),
    onSeatingChange: (() => void) | null = null,
  ) {
    this.meta = meta;
    this.state = createEmptyTable(meta.config);
    this.kv = kv;
    this.history = history;
    this.chips = chips;
    this.wallet = wallet;
    this.tournamentHook = tournamentHook;
    this.onSeatingChange = onSeatingChange;
    this.lastLobbySeats = this.seatedCount();
    // Empty until a human joins — age from creation.
    this.idleSince = meta.createdAt;
  }

  setSeatingChangeHandler(handler: (() => void) | null): void {
    this.onSeatingChange = handler;
  }

  private notifyLobbySeatingIfChanged(): void {
    if (this.meta.isPrivate || !this.meta.stakeId) return;
    const n = this.seatedCount();
    if (n === this.lastLobbySeats) return;
    this.lastLobbySeats = n;
    this.onSeatingChange?.();
  }

  /** Notify this user of chip and/or Whuffie balances when connected. */
  notifyWallet(
    userId: string,
    update: number | { chipBalance?: number; whuffieBalance?: number },
  ): void {
    if (isBotUserId(userId)) return;
    const payload =
      typeof update === 'number'
        ? { type: 'wallet_update' as const, chipBalance: update }
        : {
            type: 'wallet_update' as const,
            ...(update.chipBalance !== undefined ? { chipBalance: update.chipBalance } : {}),
            ...(update.whuffieBalance !== undefined
              ? { whuffieBalance: update.whuffieBalance }
              : {}),
          };
    this.connections.get(userId)?.send(payload);
  }

  /**
   * Real bankroll moves at this table for non-bots.
   * Cash / public rooms use free table stacks (sit / leave / top-up do not touch wallet).
   * Contest tables still debit rebuy top-ups; entry fees settle via TournamentManager.
   */
  private usesWallet(userId: string): boolean {
    if (isBotUserId(userId) || this.meta.playMoney) return false;
    return this.isTournament();
  }

  async creditCashOut(userId: string, stack: number): Promise<void> {
    if (!this.usesWallet(userId) || !Number.isFinite(stack) || stack <= 0) return;
    try {
      const result = await this.wallet.credit(userId, stack, 'cash_out', this.meta.id);
      this.notifyWallet(userId, result.balance);
    } catch (err) {
      console.error('[wallet] cash-out failed', err);
    }
  }

  /**
   * Mark private host rooms as free-play when bots are added before any human sits.
   * Public stake and tournament tables never become play-money.
   */
  private maybeEnablePlayMoneyForBots(): void {
    if (this.meta.playMoney) return;
    if (this.meta.tournament || this.meta.stakeId || !this.meta.isPrivate) return;
    const humanSeated = this.state.players.some(
      (p) => p.userId && p.status !== 'empty' && !isBotUserId(p.userId),
    );
    if (!humanSeated) {
      this.meta.playMoney = true;
    }
  }

  setTournamentHook(hook: TournamentHandEndedHook | null): void {
    this.tournamentHook = hook;
  }

  isTournament(): boolean {
    return Boolean(this.meta.tournament);
  }

  /** Seat a player without websocket (contest assignment). */
  forceSeat(
    userId: string,
    name: string,
    seat: number,
    stack: number,
  ): { ok: boolean; error?: string } {
    if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }
    const result = sitDown(this.state, seat, userId, name, stack);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.avatarByUser.set(userId, avatarIdFromUserId(userId));
    this.refreshIdleClock();
    void this.afterStateChange();
    return { ok: true };
  }

  applyBlindLevel(smallBlind: number, bigBlind: number): void {
    this.meta.config = {
      ...this.meta.config,
      smallBlind,
      bigBlind,
    };
  }

  playersWithChips(): { userId: string; name: string | null; seat: number; stack: number }[] {
    return this.state.players
      .filter((p) => p.userId && p.status !== 'empty' && p.stack > 0)
      .map((p) => ({
        userId: p.userId!,
        name: p.name,
        seat: p.seat,
        stack: p.stack,
      }));
  }

  playersBusted(): { userId: string; name: string | null; seat: number }[] {
    return this.state.players
      .filter((p) => p.userId && p.status !== 'empty' && p.stack === 0)
      .map((p) => ({
        userId: p.userId!,
        name: p.name,
        seat: p.seat,
      }));
  }

  seatedPlayersSnapshot(): {
    userId: string;
    name: string | null;
    seat: number;
    stack: number;
  }[] {
    return this.state.players
      .filter((p) => p.userId && p.status !== 'empty')
      .map((p) => ({
        userId: p.userId!,
        name: p.name,
        seat: p.seat,
        stack: p.stack,
      }));
  }

  /** Vacate a busted tournament seat between hands. */
  eliminateSeat(seat: number): void {
    if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }
    const p = this.state.players[seat];
    if (!p || p.status === 'empty') return;
    const name = p.name ?? 'Player';
    const result = standUp(this.state, seat);
    if (result.ok) {
      this.state = result.state;
      this.systemChat('Dealer', `${name} is eliminated`);
      void this.afterStateChange();
    }
  }

  freezeTournamentMatch(): void {
    if (this.meta.tournament) {
      this.meta.tournament = { ...this.meta.tournament, frozen: true };
    }
    if (this.autoStartTimer) {
      clearTimeout(this.autoStartTimer);
      this.autoStartTimer = null;
    }
    this.clearBotReadyTimers();
    this.botReadyUserIds.clear();
    this.clearTurnTimer();
    if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }
    this.systemChat('Dealer', 'Match over');
    this.broadcast();
  }

  /** Public wrapper for tournament system chat. */
  systemChatPublic(name: string, text: string): void {
    this.systemChat(name, text);
  }

  /**
   * Contests use Ready consensus (same as cash) — no auto-deal between hands.
   * Kept as a no-op for call-site compatibility.
   */
  scheduleTournamentAutoStart(_delayMs = 2200): void {
    // no-op: humans must Ready up before each deal on cash and contest tables
  }

  get config(): TableConfig {
    return this.meta.config;
  }

  /** Players currently seated (humans or bots). */
  seatedCount(): number {
    return this.state.players.filter((p) => p.status !== 'empty').length;
  }

  /** True while any human is connected, seated, or inside disconnect grace. */
  hasHumanPresence(): boolean {
    for (const userId of this.connections.keys()) {
      if (!isBotUserId(userId)) return true;
    }
    for (const p of this.state.players) {
      if (p.userId && p.status !== 'empty' && !isBotUserId(p.userId)) return true;
    }
    for (const userId of this.disconnectTimers.keys()) {
      if (!isBotUserId(userId)) return true;
    }
    return false;
  }

  /**
   * True when no humans have been present for `ms` (tournament rooms never idle-terminate).
   */
  isIdle(ms: number = ROOM_INACTIVITY_MS, now: number = Date.now()): boolean {
    if (this.closed || this.isTournament()) return false;
    if (this.hasHumanPresence()) return false;
    if (this.idleSince == null) return false;
    return now - this.idleSince >= ms;
  }

  /** Start/clear the idle clock when human presence changes. */
  private refreshIdleClock(now: number = Date.now()): void {
    if (this.hasHumanPresence()) {
      this.idleSince = null;
    } else if (this.idleSince == null) {
      this.idleSince = now;
    }
  }

  /**
   * Tear down the live room: cash out humans, clear timers, notify sockets.
   * RoomManager removes the room from maps after this.
   */
  shutdown(message = 'Table closed due to inactivity'): void {
    if (this.closed) return;
    this.closed = true;

    this.clearTurnTimer();
    this.clearBotReadyTimers();
    if (this.autoStartTimer) {
      clearTimeout(this.autoStartTimer);
      this.autoStartTimer = null;
    }
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();

    if (this.state.street !== 'waiting' && this.state.street !== 'payout') {
      this.state = returnToWaiting(this.state);
    } else if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }

    for (const p of [...this.state.players]) {
      if (!p.userId || p.status === 'empty') continue;
      const userId = p.userId;
      const stack = p.stack;
      if (!isBotUserId(userId)) {
        void this.creditCashOut(userId, stack);
      }
      const vacated = standUp(this.state, p.seat);
      if (vacated.ok) this.state = vacated.state;
    }

    this.readyUserIds.clear();
    this.botReadyUserIds.clear();
    this.pendingSitOutUserIds.clear();
    this.voiceParticipants.clear();

    for (const conn of this.connections.values()) {
      try {
        conn.send({ type: 'error', message, code: 'room_closed' });
      } catch {
        /* ignore */
      }
    }
    this.connections.clear();
    this.spectators.clear();
  }

  attach(conn: ConnectionContext): void {
    if (this.closed) {
      conn.send({
        type: 'error',
        message: 'Table closed due to inactivity',
        code: 'room_closed',
      });
      return;
    }
    this.cancelDisconnect(conn.userId);
    this.connections.set(conn.userId, conn);
    this.spectators.add(conn.userId);
    this.avatarByUser.set(conn.userId, clampAvatarId(conn.avatarId));
    if (conn.avatarUrl) this.avatarUrlByUser.set(conn.userId, conn.avatarUrl);
    else this.avatarUrlByUser.delete(conn.userId);
    this.refreshIdleClock();
    this.pushTo(conn.userId);
  }

  /** True if `send` is still the room's live connection for this user. */
  isActiveConnection(userId: string, send: ConnectionContext['send']): boolean {
    return this.connections.get(userId)?.send === send;
  }

  /**
   * Seat a newly joined player at the first empty seat.
   * Restores reserved chips after a kick when present; otherwise table buy-in.
   * No-op if already seated, spectating, or the table is full.
   */
  async autoSit(userId: string, name: string): Promise<{ ok: boolean; error?: string }> {
    if (this.seatOf(userId) !== null) return { ok: true };
    const empty = this.state.players.find((p) => p.status === 'empty');
    if (!empty) return { ok: false, error: 'Table full' };
    return this.sit(userId, name, empty.seat, this.config.buyIn);
  }

  /**
   * Drop this user only if `send` is still their active connection.
   * Prevents a late close from an old tab/socket from clearing a newer reconnect.
   */
  detachIfActive(userId: string, send: ConnectionContext['send']): boolean {
    if (!this.isActiveConnection(userId, send)) return false;
    this.detach(userId);
    return true;
  }

  detach(userId: string): void {
    this.leaveVoice(userId);
    this.connections.delete(userId);
    this.spectators.delete(userId);
    this.refreshIdleClock();
  }

  /** Start grace period after socket drop; seat is vacated if player does not reconnect. */
  scheduleDisconnect(userId: string): void {
    this.cancelDisconnect(userId);
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      if (!this.connections.has(userId)) {
        this.leave(userId);
      } else {
        this.refreshIdleClock();
      }
    }, DISCONNECT_GRACE_MS);
    this.disconnectTimers.set(userId, timer);
    this.refreshIdleClock();
  }

  private cancelDisconnect(userId: string): void {
    const timer = this.disconnectTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(userId);
    }
  }

  /** Fold/stand if seated, then detach the websocket — preferred leave path. */
  leave(userId: string): { ok: boolean; error?: string } {
    if (this.closed) {
      this.detach(userId);
      return { ok: true };
    }
    this.cancelDisconnect(userId);
    this.readyUserIds.delete(userId);
    const seat = this.seatOf(userId);
    if (seat !== null) {
      const name = this.state.players[seat]?.name ?? 'Player';
      const stack = this.state.players[seat]?.stack ?? 0;
      const tournamentFrozen = Boolean(this.meta.tournament?.frozen);
      const result = leaveSeat(this.state, seat);
      if (result.ok) {
        this.state = result.state;
        this.announceEngineEvents(result.events);
        this.systemChat('Dealer', `${name} leaves the table`);
        // Contest finish already settled stack to the wallet — do not cash out again.
        if (!tournamentFrozen) {
          void this.creditCashOut(userId, stack);
        }
        void this.afterStateChange();
      } else if (result.error?.includes('All-in')) {
        this.systemChat('Dealer', `${name} disconnects (all-in — seat stays until hand ends)`);
        // Keep seat for the runout; just drop the socket below.
      } else {
        // Best-effort: still detach so reconnects aren't blocked.
        this.systemChat('Dealer', `${name} leaves`);
      }
    }
    this.detach(userId);
    this.refreshIdleClock();
    return { ok: true };
  }

  private rateLimit(key: string, max = 20, windowMs = 5000): boolean {
    const now = Date.now();
    let b = this.rateLimits.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      this.rateLimits.set(key, b);
    }
    if (b.count >= max) return false;
    b.count += 1;
    return true;
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
    this.turnEndsAt = null;
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
      this.turnEndsAt = Date.now() + delay;
      this.turnTimer = setTimeout(() => this.runBotTurn(seat), delay);
      return;
    }

    this.turnEndsAt = Date.now() + this.config.turnTimeMs;
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
    count = 1,
    namePool?: readonly string[],
    styles?: BotStyleOptions | null,
  ): { ok: boolean; error?: string; added?: number } {
    // Public cash tables are humans-only (bots are private host / practice).
    if (!this.meta.isPrivate) {
      return { ok: false, error: 'Bots are only allowed on private tables' };
    }
    // Allowed mid-hand — new bots sit as `seated` and join on the next deal.
    if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }

    const amount = buyIn ?? this.config.buyIn;
    if (amount !== this.config.buyIn) {
      return { ok: false, error: 'Buy-in must match table buy-in' };
    }

    if (namePool && namePool.length > 0) {
      this.botNamePool = [...namePool];
    }
    if (styles) {
      this.botStyles = {
        defaultPersonality: styles.defaultPersonality ?? null,
        namePersonalities: { ...(styles.namePersonalities ?? {}) },
      };
    }

    // Specific seat → always one bot
    const toAdd = seat !== undefined ? 1 : Math.max(1, Math.min(9, count));
    let added = 0;
    const joined: string[] = [];

    for (let i = 0; i < toAdd; i++) {
      const emptySeats = this.state.players.filter((p) => p.status === 'empty').map((p) => p.seat);
      if (emptySeats.length === 0) break;

      let nextSeat = emptySeats[0]!;
      if (i === 0 && seat !== undefined) {
        if (!emptySeats.includes(seat)) break;
        nextSeat = seat;
      }

      const taken = new Set(this.state.players.filter((p) => p.name).map((p) => p.name!));
      const name = pickBotName(taken, this.botNamePool ?? undefined);
      const bareId = nanoid(8);
      const personality = resolveBotPersonalityId(name, bareId, this.botStyles);
      const userId = makeBotUserId(bareId, personality);
      const result = sitDown(this.state, nextSeat, userId, name, amount);
      if (!result.ok) break;
      this.state = result.state;
      this.avatarByUser.set(userId, avatarIdFromUserId(userId));
      joined.push(name);
      added += 1;
    }

    if (added === 0) return { ok: false, error: 'Table full' };

    // Before humans paid in: private host + bots is free practice.
    this.maybeEnablePlayMoneyForBots();

    this.systemChat(
      'Dealer',
      added === 1
        ? `${joined[0]} joins as a bot`
        : `${added} bots join — ${joined.join(', ')}`,
    );
    void this.afterStateChange();
    if (this.state.street === 'waiting') this.maybeAutoStart();
    return { ok: true, added };
  }

  removeBot(seat: number): { ok: boolean; error?: string } {
    const p = this.state.players[seat];
    if (!p || !isBotUserId(p.userId)) return { ok: false, error: 'Not a bot seat' };
    if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }
    const name = p.name ?? 'Bot';
    if (p.userId) this.clearBotReady(p.userId);
    const result = standUp(this.state, seat);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.systemChat('Dealer', `${name} leaves the table`);
    void this.afterStateChange();
    return { ok: true };
  }

  removeAllBots(): { ok: boolean; error?: string; removed?: number } {
    if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }
    let removed = 0;
    for (const p of [...this.state.players]) {
      if (!isBotUserId(p.userId)) continue;
      if (p.userId) this.clearBotReady(p.userId);
      const result = standUp(this.state, p.seat);
      if (result.ok) {
        this.state = result.state;
        removed += 1;
      }
    }
    if (removed === 0) return { ok: false, error: 'No bots available to remove' };
    this.systemChat('Dealer', `Removed ${removed} bot${removed === 1 ? '' : 's'}`);
    void this.afterStateChange();
    return { ok: true, removed };
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

  private enrichPublic() {
    const base = toPublicView(this.meta.id, this.state, this.config);
    const between =
      this.state.street === 'waiting' || this.state.street === 'payout';
    return {
      ...base,
      hostUserId: this.meta.hostUserId,
      isPrivate: this.meta.isPrivate,
      turnEndsAt: this.turnEndsAt,
      tournament: this.meta.tournament
        ? {
            contestId: this.meta.tournament.contestId,
            mode: this.meta.tournament.mode,
            matchId: null,
            frozen: Boolean(this.meta.tournament.frozen),
            noTopUp: !this.meta.tournament.allowTopUp,
            handsPlayed: this.meta.tournament.handsPlayed ?? 0,
            handLimit:
              this.meta.tournament.handLimit !== undefined
                ? this.meta.tournament.handLimit
                : null,
          }
        : null,
      players: base.players.map((p) => {
        const eligible =
          between &&
          !!p.userId &&
          p.stack > 0 &&
          p.status !== 'sittingOut' &&
          p.status !== 'empty';
        const ready =
          eligible &&
          !!p.userId &&
          (isBotUserId(p.userId)
            ? this.botReadyUserIds.has(p.userId)
            : this.readyUserIds.has(p.userId));
        return {
          ...p,
          ready: Boolean(ready),
          pendingSitOut: !!p.userId && this.pendingSitOutUserIds.has(p.userId),
          avatarId: p.userId
            ? (this.avatarByUser.get(p.userId) ?? avatarIdFromUserId(p.userId))
            : null,
          avatarUrl: p.userId ? (this.avatarUrlByUser.get(p.userId) ?? null) : null,
        };
      }),
    };
  }

  private pushTo(userId: string): void {
    const conn = this.connections.get(userId);
    if (!conn) return;
    const seat = this.seatOf(userId);
    const table = this.enrichPublic();
    const priv = seat !== null ? toPrivateView(this.state, seat, this.config) : null;
    conn.send({ type: 'state_sync', table, private: priv });
  }

  broadcast(): void {
    for (const userId of this.connections.keys()) {
      this.pushTo(userId);
    }
  }

  private async afterStateChange(): Promise<void> {
    // After a hand (or when waiting), apply "sit out next" flags.
    if (this.state.street === 'payout' || this.state.street === 'waiting') {
      this.applyPendingSitOuts();
      this.scheduleBotAutoReady();
    }
    if (this.state.street === 'payout') {
      if (this.state.handId && this.state.handId !== this.lastRecordedHandId) {
        this.lastRecordedHandId = this.state.handId;
        try {
          await this.history.recordHand({
            tableId: this.meta.id,
            handId: this.state.handId,
            contestId: this.meta.tournament?.contestId ?? null,
            source: 'online',
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
                holeCards: p.holeCards,
              })),
              actions: this.handActions,
              chat: this.handChat,
            },
          });
        } catch (err) {
          console.error('[history] recordHand failed', err);
        }
      }
      if (
        this.isTournament() &&
        this.tournamentHook &&
        this.state.handId &&
        this.state.handId !== this.lastNotifiedHandId
      ) {
        this.lastNotifiedHandId = this.state.handId;
        try {
          this.tournamentHook(this);
        } catch (err) {
          console.error('[tournament] hand-ended hook failed', err);
        }
      }
      // Cash: stay on payout until Next Hand. Tournament: hook schedules next deal.
    }
    this.armTurnTimer();
    this.broadcast();
    this.notifyLobbySeatingIfChanged();
    await this.persist();
  }

  maybeAutoStart(): void {
    // Cash and contest tables require every human to ready up (no auto-deal).
    this.scheduleBotAutoReady();
  }

  private clearBotReadyTimers(): void {
    for (const timer of this.botReadyTimers.values()) clearTimeout(timer);
    this.botReadyTimers.clear();
  }

  private clearBotReady(userId: string): void {
    const timer = this.botReadyTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.botReadyTimers.delete(userId);
    }
    this.botReadyUserIds.delete(userId);
  }

  private resetBotReadyState(): void {
    this.clearBotReadyTimers();
    this.botReadyUserIds.clear();
  }

  /** Stagger bot ready badges between hands (deal gating still treats bots as always ready). */
  private scheduleBotAutoReady(): void {
    if (this.meta.tournament?.frozen) return;
    if (this.state.street !== 'waiting' && this.state.street !== 'payout') return;

    for (const { userId, human } of this.eligibleForNextHand()) {
      if (human) continue;
      if (this.botReadyUserIds.has(userId) || this.botReadyTimers.has(userId)) continue;

      const delay = 400 + Math.floor(Math.random() * 1200);
      const timer = setTimeout(() => {
        this.botReadyTimers.delete(userId);
        if (this.state.street !== 'waiting' && this.state.street !== 'payout') return;
        const stillEligible = this.eligibleForNextHand().some(
          (e) => e.userId === userId && !e.human,
        );
        if (!stillEligible) return;
        this.botReadyUserIds.add(userId);
        this.broadcast();
      }, delay);
      this.botReadyTimers.set(userId, timer);
    }
  }

  /**
   * Toggle ready. Deals when all eligible humans are ready (cash + contest).
   */
  startHand(userId: string): { ok: boolean; error?: string } {
    const currentlyReady = this.readyUserIds.has(userId);
    return this.setReady(userId, !currentlyReady);
  }

  setReady(userId: string, ready: boolean): { ok: boolean; error?: string } {
    if (this.meta.tournament?.frozen) {
      return { ok: false, error: 'Match is over' };
    }
    if (this.state.street !== 'waiting' && this.state.street !== 'payout') {
      return { ok: false, error: 'Hand in progress' };
    }
    if (isBotUserId(userId)) {
      return { ok: false, error: 'Bots are always ready' };
    }
    const seat = this.seatOf(userId);
    if (seat === null) {
      return { ok: false, error: 'Sit down before ready' };
    }
    const me = this.state.players[seat];
    if (!me || me.status === 'sittingOut') {
      return { ok: false, error: 'Sit in before ready' };
    }
    if (me.stack <= 0) {
      return { ok: false, error: 'Top up before ready' };
    }
    if (ready) this.readyUserIds.add(userId);
    else this.readyUserIds.delete(userId);
    void this.afterStateChange();
    this.tryDealIfAllReady();
    return { ok: true };
  }

  private eligibleForNextHand(): { userId: string; human: boolean }[] {
    return this.state.players
      .filter(
        (p) =>
          !!p.userId &&
          p.stack > 0 &&
          p.status !== 'sittingOut' &&
          p.status !== 'empty',
      )
      .map((p) => ({
        userId: p.userId!,
        human: !isBotUserId(p.userId!),
      }));
  }

  private tryDealIfAllReady(): void {
    if (this.meta.tournament?.frozen) return;
    if (this.state.street !== 'waiting' && this.state.street !== 'payout') return;
    const eligible = this.eligibleForNextHand();
    if (eligible.length < 2) return;
    const humans = eligible.filter((e) => e.human);
    if (humans.length === 0) return;
    for (const h of humans) {
      if (!this.readyUserIds.has(h.userId)) return;
    }
    void this.dealHand();
  }

  /** Actually deal when all eligible humans are ready. */
  private dealHand(): { ok: boolean; error?: string } {
    if (this.meta.tournament?.frozen) {
      return { ok: false, error: 'Match is over' };
    }
    if (this.state.street !== 'waiting' && this.state.street !== 'payout') {
      return { ok: false, error: 'Hand in progress' };
    }
    if (this.state.street === 'payout') {
      this.state = returnToWaiting(this.state);
    }
    const readyCount = this.state.players.filter(
      (p) => p.userId && p.stack > 0 && p.status !== 'sittingOut',
    ).length;
    if (readyCount < 2) {
      return { ok: false, error: 'Need at least 2 players with chips' };
    }
    this.readyUserIds.clear();
    this.resetBotReadyState();
    this.handActions = [];
    this.handChat = [];
    const handId = nanoid(10);
    this.handStartedAt = Date.now();
    const result = startHand(this.state, this.config, handId, (n) => randomBytes(n));
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.announceEngineEvents(result.events);
    void this.afterStateChange();
    return { ok: true };
  }

  /** Host removes a seated player between hands (cash only). */
  async kickPlayer(hostId: string, seat: number): Promise<{ ok: boolean; error?: string }> {
    if (this.isTournament()) {
      return { ok: false, error: 'Cannot kick in tournament' };
    }
    if (hostId !== this.meta.hostUserId) {
      return { ok: false, error: 'Only the host can kick players' };
    }
    if (this.state.street !== 'waiting' && this.state.street !== 'payout') {
      return { ok: false, error: 'Wait until the hand ends' };
    }
    const target = this.state.players[seat];
    if (!target || target.status === 'empty' || !target.userId) {
      return { ok: false, error: 'Empty seat' };
    }
    if (target.userId === hostId) {
      return { ok: false, error: 'Cannot kick yourself' };
    }
    const kickedName = target.name ?? 'Player';
    const kickedId = target.userId;
    const reservedStack = target.stack;
    this.readyUserIds.delete(kickedId);

    if (isBotUserId(kickedId)) {
      const result = standUp(this.state, seat);
      if (!result.ok) return { ok: false, error: result.error };
      this.state = result.state;
      this.systemChat('Dealer', `Host removed ${kickedName}`);
      void this.afterStateChange();
      return { ok: true };
    }

    // Human: vacate seat, persist stack for rejoin, and drop connection if present.
    const result = leaveSeat(this.state, seat);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.announceEngineEvents(result.events);
    // Only hold a positive stack for rejoin. Zero means busted — next sit does a fresh buy-in.
    if (reservedStack > 0) {
      try {
        await this.chips.reserve(this.meta.id, kickedId, reservedStack);
      } catch (err) {
        console.error('[chips] failed to reserve kick stack', err);
      }
    }
    if (this.connections.has(kickedId)) {
      const conn = this.connections.get(kickedId)!;
      conn.send({ type: 'error', message: 'You were removed from the table', code: 'kicked' });
      this.detach(kickedId);
    }
    this.systemChat('Dealer', `Host removed ${kickedName}`);
    void this.afterStateChange();
    return { ok: true };
  }

  async sit(
    userId: string,
    name: string,
    seat: number,
    buyIn: number,
  ): Promise<{ ok: boolean; error?: string }> {
    // Queue sits so join_table autoSit and client sit cannot both pass seatOf across awaits.
    const run = this.sitChain.then(() => this.sitUnlocked(userId, name, seat, buyIn));
    this.sitChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async sitUnlocked(
    userId: string,
    name: string,
    seat: number,
    buyIn: number,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.rateLimit(`${userId}:sit`)) return { ok: false, error: 'Rate limited' };
    // Idempotent same-seat retry: server autoSit + client fallback often race on one seat.
    const existingSeat = this.seatOf(userId);
    if (existingSeat !== null) {
      if (existingSeat === seat) return { ok: true };
      return { ok: false, error: 'Already seated' };
    }
    if (this.isTournament()) {
      return { ok: false, error: 'Tournament seats are assigned' };
    }

    let reserved: number | null = null;
    try {
      reserved = await this.chips.take(this.meta.id, userId);
    } catch (err) {
      console.error('[chips] failed to load reserved stack', err);
    }

    // 0 / non-finite holds are not rebuy credits — debit a full table buy-in instead.
    // (NaN fails `<= 0`, so it previously skipped debit and seated stack NaN → UI 0.)
    if (reserved == null || !Number.isFinite(reserved) || reserved <= 0) {
      reserved = null;
    }

    const stack = reserved ?? buyIn;
    if (!Number.isFinite(stack) || stack <= 0) {
      return { ok: false, error: 'Invalid buy-in' };
    }
    if (reserved == null && buyIn !== this.config.buyIn) {
      return { ok: false, error: 'Buy-in must match table buy-in' };
    }

    // Re-check after awaits: a queued peer sit may have seated us already.
    const seatedAfterAwait = this.seatOf(userId);
    if (seatedAfterAwait !== null) {
      if (reserved != null) {
        try {
          await this.chips.reserve(this.meta.id, userId, reserved);
        } catch (err) {
          console.error('[chips] failed to restore reserved stack after concurrent sit', err);
        }
      }
      if (seatedAfterAwait === seat) return { ok: true };
      return { ok: false, error: 'Already seated' };
    }

    let debited = false;
    if (reserved == null && this.usesWallet(userId)) {
      try {
        const paid = await this.wallet.debit(userId, buyIn, 'buy_in', this.meta.id);
        debited = true;
        this.notifyWallet(userId, paid.balance);
      } catch (err) {
        if (err instanceof WalletError && err.code === 'insufficient') {
          return { ok: false, error: err.message };
        }
        console.error('[wallet] buy-in debit failed', err);
        return { ok: false, error: 'Could not process buy-in' };
      }
    }

    // Another await gap (debit): if we now own the seat, refund duplicate debit.
    const seatedAfterDebit = this.seatOf(userId);
    if (seatedAfterDebit !== null) {
      if (debited) {
        try {
          const refund = await this.wallet.credit(userId, buyIn, 'cash_out', this.meta.id);
          this.notifyWallet(userId, refund.balance);
        } catch (err) {
          console.error('[wallet] buy-in refund failed', err);
        }
      }
      if (reserved != null) {
        try {
          await this.chips.reserve(this.meta.id, userId, reserved);
        } catch (err) {
          console.error('[chips] failed to restore reserved stack after concurrent sit', err);
        }
      }
      if (seatedAfterDebit === seat) return { ok: true };
      return { ok: false, error: 'Already seated' };
    }

    const result = sitDown(this.state, seat, userId, name, stack);
    if (!result.ok) {
      // Lost a same-seat race to our own sit — treat as success after undoing this attempt.
      if (this.seatOf(userId) === seat) {
        if (reserved != null) {
          try {
            await this.chips.reserve(this.meta.id, userId, reserved);
          } catch (err) {
            console.error('[chips] failed to restore reserved stack after sit race', err);
          }
        }
        if (debited) {
          try {
            const refund = await this.wallet.credit(userId, buyIn, 'cash_out', this.meta.id);
            this.notifyWallet(userId, refund.balance);
          } catch (err) {
            console.error('[wallet] buy-in refund failed', err);
          }
        }
        return { ok: true };
      }
      if (reserved != null) {
        try {
          await this.chips.reserve(this.meta.id, userId, reserved);
        } catch (err) {
          console.error('[chips] failed to restore reserved stack after sit failure', err);
        }
      }
      if (debited) {
        try {
          const refund = await this.wallet.credit(userId, buyIn, 'cash_out', this.meta.id);
          this.notifyWallet(userId, refund.balance);
        } catch (err) {
          console.error('[wallet] buy-in refund failed', err);
        }
      }
      return { ok: false, error: result.error };
    }
    this.state = result.state;
    const conn = this.connections.get(userId);
    if (conn) this.avatarByUser.set(userId, clampAvatarId(conn.avatarId));
    else if (!this.avatarByUser.has(userId)) {
      this.avatarByUser.set(userId, avatarIdFromUserId(userId));
    }
    this.refreshIdleClock();
    void this.afterStateChange();
    this.maybeAutoStart();
    return { ok: true };
  }

  stand(userId: string, seat: number): { ok: boolean; error?: string } {
    if (this.seatOf(userId) !== seat) return { ok: false, error: 'Not your seat' };
    this.readyUserIds.delete(userId);
    const stack = this.state.players[seat]?.stack ?? 0;
    const result = standUp(this.state, seat);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    void this.creditCashOut(userId, stack);
    this.refreshIdleClock();
    void this.afterStateChange();
    return { ok: true };
  }

  doSitOut(userId: string, seat: number): { ok: boolean; error?: string } {
    if (this.seatOf(userId) !== seat) return { ok: false, error: 'Not your seat' };
    this.readyUserIds.delete(userId);

    // Toggle off a pending “sit out after this hand” request.
    if (this.pendingSitOutUserIds.has(userId)) {
      this.pendingSitOutUserIds.delete(userId);
      void this.afterStateChange();
      return { ok: true };
    }

    const between =
      this.state.street === 'waiting' || this.state.street === 'payout';
    const me = this.state.players[seat];
    if (
      !between &&
      me &&
      (me.status === 'active' || me.status === 'allin')
    ) {
      // Finish this hand, then skip the next deal until sit-in.
      this.pendingSitOutUserIds.add(userId);
      void this.afterStateChange();
      return { ok: true };
    }

    const result = sitOut(this.state, seat);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.pendingSitOutUserIds.delete(userId);
    void this.afterStateChange();
    return { ok: true };
  }

  doSitIn(userId: string, seat: number): { ok: boolean; error?: string } {
    if (this.seatOf(userId) !== seat) return { ok: false, error: 'Not your seat' };
    this.pendingSitOutUserIds.delete(userId);
    const result = sitIn(this.state, seat);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    // Sitting in implies ready for the next deal (same as “Play Next Hand”).
    const me = this.state.players[seat];
    if (me && me.stack > 0 && me.status !== 'sittingOut' && me.status !== 'empty') {
      this.readyUserIds.add(userId);
    } else {
      this.readyUserIds.delete(userId);
    }
    void this.afterStateChange();
    this.tryDealIfAllReady();
    return { ok: true };
  }

  /** Apply deferred sit-outs once the hand is over. */
  private applyPendingSitOuts(): void {
    if (this.pendingSitOutUserIds.size === 0) return;
    for (const userId of [...this.pendingSitOutUserIds]) {
      this.pendingSitOutUserIds.delete(userId);
      const seat = this.seatOf(userId);
      if (seat === null) continue;
      const me = this.state.players[seat];
      if (!me || me.status === 'sittingOut' || me.status === 'empty') continue;
      const result = sitOut(this.state, seat);
      if (result.ok) {
        this.state = result.state;
        this.readyUserIds.delete(userId);
      }
    }
  }

  async doTopUp(userId: string, seat: number, amount: number): Promise<{ ok: boolean; error?: string }> {
    if (this.isTournament() && !this.meta.tournament?.allowTopUp) {
      return { ok: false, error: 'No top-up in this contest' };
    }
    if (this.seatOf(userId) !== seat) return { ok: false, error: 'Not your seat' };

    const n = Math.floor(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: 'Invalid top-up amount' };
    }

    if (!this.usesWallet(userId)) {
      const result = topUp(this.state, seat, n, this.config.buyIn);
      if (!result.ok) return { ok: false, error: result.error };
      this.state = result.state;
      void this.afterStateChange();
      return { ok: true };
    }

    try {
      const paid = await this.wallet.debit(userId, n, 'top_up', this.meta.id);
      this.notifyWallet(userId, paid.balance);
    } catch (err) {
      if (err instanceof WalletError && err.code === 'insufficient') {
        return { ok: false, error: err.message };
      }
      console.error('[wallet] top-up debit failed', err);
      return { ok: false, error: 'Could not process top-up' };
    }

    const result = topUp(this.state, seat, n, this.config.buyIn);
    if (!result.ok) {
      try {
        const refund = await this.wallet.credit(userId, n, 'cash_out', this.meta.id);
        this.notifyWallet(userId, refund.balance);
      } catch (err) {
        console.error('[wallet] top-up refund failed', err);
      }
      return { ok: false, error: result.error };
    }
    this.state = result.state;
    void this.afterStateChange();
    return { ok: true };
  }

  /** Between hands: rebuy bots to full buy-in when top-ups are allowed. */
  autoTopUpBrokeBots(): number {
    if (!this.meta.tournament?.allowTopUp) return 0;
    if (this.state.street !== 'waiting' && this.state.street !== 'payout') return 0;
    let count = 0;
    for (const p of this.state.players) {
      if (!p.userId || p.status === 'empty' || p.stack > 0) continue;
      if (!isBotUserId(p.userId)) continue;
      const result = topUp(this.state, p.seat, this.config.buyIn, this.config.buyIn);
      if (result.ok) {
        this.state = result.state;
        count += 1;
      }
    }
    if (count > 0) void this.afterStateChange();
    return count;
  }

  action(
    userId: string,
    handId: string,
    seq: number,
    type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin',
    amount?: number,
  ): { ok: boolean; error?: string } {
    if (!this.rateLimit(`${userId}:action`, 30, 5000)) return { ok: false, error: 'Rate limited' };
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
    const at = Date.now();
    for (const e of events) {
      this.handActions.push({ ...e, at });
      if (e.type === 'action') {
        const p = this.state.players[e.seat];
        const name = p?.name ?? `Seat ${e.seat}`;
        const line = formatActionLine(e.action, e.amount);
        this.systemChat(name, line);
        const seatAction = {
          type: 'seat_action' as const,
          tableId: this.meta.id,
          seat: e.seat,
          action: e.action,
          amount: e.amount,
          label: formatActionPopup(e.action, e.amount),
          at,
        };
        for (const conn of this.connections.values()) conn.send(seatAction);
      } else if (e.type === 'street') {
        const label = e.street.charAt(0).toUpperCase() + e.street.slice(1);
        this.systemChat('Dealer', `${label} — ${e.cards.map(cardToString).join(' ')}`);
      } else if (e.type === 'hand_ended') {
        if (e.winners.length === 1) {
          const w = e.winners[0]!;
          const name = this.state.players[w.seat]?.name ?? `Seat ${w.seat}`;
          const hand =
            w.handName && w.handName !== 'Uncontested' ? ` with ${w.handName}` : '';
          this.systemChat('Dealer', `${name} wins ${w.amount}${hand}`);
        } else if (e.winners.length > 1) {
          const parts = e.winners.map((w) => {
            const name = this.state.players[w.seat]?.name ?? `Seat ${w.seat}`;
            const hand =
              w.handName && w.handName !== 'Uncontested' ? ` (${w.handName})` : '';
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

  private broadcastChat(
    userId: string,
    name: string,
    text: string,
    kind: 'user' | 'system' | 'emoji',
  ): number {
    const at = Date.now();
    const msg = { type: 'chat' as const, tableId: this.meta.id, userId, name, text, at };
    for (const conn of this.connections.values()) conn.send(msg);
    if (this.state.street !== 'waiting' && this.state.handId) {
      this.handChat.push({ at, userId, name, text });
    }
    void this.history
      .recordChat({
        tableId: this.meta.id,
        contestId: this.meta.tournament?.contestId ?? null,
        handId: this.state.street === 'waiting' ? null : this.state.handId || null,
        userId,
        name,
        text,
        at,
        kind,
        source: 'online',
      })
      .catch((err) => console.error('[history] recordChat failed', err));
    return at;
  }

  private systemChat(name: string, text: string): void {
    this.broadcastChat('system', name, text, 'system');
  }

  chat(userId: string, name: string, text: string): void {
    if (!this.rateLimit(`${userId}:chat`, 10, 5000)) return;
    this.broadcastChat(userId, name, text, 'user');
  }

  emoji(userId: string, name: string, emoji: string): void {
    if (!this.rateLimit(`${userId}:emoji`, 20, 5000)) return;
    const at = this.broadcastChat(userId, name, emoji, 'emoji');
    const react = { type: 'emoji' as const, tableId: this.meta.id, userId, name, emoji, at };
    for (const conn of this.connections.values()) conn.send(react);
  }

  joinVoice(userId: string, name: string): { ok: boolean; error?: string } {
    if (!this.rateLimit(`${userId}:voice`, 8, 5000)) {
      return { ok: false, error: 'Rate limited' };
    }
    if (!this.connections.has(userId)) {
      return { ok: false, error: 'Not connected to table' };
    }
    this.voiceParticipants.set(userId, name);
    this.sendVoiceRoster(userId);
    for (const uid of this.voiceParticipants.keys()) {
      if (uid === userId) continue;
      this.connections.get(uid)?.send({ type: 'voice_peer_joined', userId, name });
    }
    return { ok: true };
  }

  leaveVoice(userId: string): void {
    if (!this.voiceParticipants.delete(userId)) return;
    for (const uid of this.voiceParticipants.keys()) {
      this.connections.get(uid)?.send({ type: 'voice_peer_left', userId });
    }
  }

  relayVoiceSignal(
    fromUserId: string,
    toUserId: string,
    signal: unknown,
  ): { ok: boolean; error?: string } {
    if (!this.rateLimit(`${fromUserId}:voice_signal`, 120, 5000)) {
      return { ok: false, error: 'Rate limited' };
    }
    if (!this.voiceParticipants.has(fromUserId)) {
      return { ok: false, error: 'Join voice first' };
    }
    if (!this.voiceParticipants.has(toUserId)) {
      return { ok: false, error: 'Peer not in voice' };
    }
    const conn = this.connections.get(toUserId);
    if (!conn) return { ok: false, error: 'Peer offline' };
    conn.send({ type: 'voice_signal', fromUserId, signal });
    return { ok: true };
  }

  private sendVoiceRoster(userId: string): void {
    const peers = [...this.voiceParticipants.entries()].map(([id, peerName]) => ({
      userId: id,
      name: peerName,
    }));
    this.connections.get(userId)?.send({ type: 'voice_roster', peers });
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

/** Short seat bubble label. */
function formatActionPopup(
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin',
  amount: number,
): string {
  switch (action) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return `Call ${amount}`;
    case 'bet':
      return `Bet ${amount}`;
    case 'raise':
      return `Raise ${amount}`;
    case 'allin':
      return amount > 0 ? `All-in ${amount}` : 'All-in';
    default:
      return action;
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private byInvite = new Map<string, string>();
  private kv: KvStore;
  private history: HandHistoryStore;
  private chips: TableChipStore;
  private wallet: WalletStore;
  private tournamentHook: TournamentHandEndedHook | null = null;
  private onPublicLobbyChange: (() => void) | null = null;

  constructor(
    kv: KvStore,
    history: HandHistoryStore,
    chips: TableChipStore = new MemoryTableChipStore(),
    wallet: WalletStore = new UnlimitedWalletStore(),
  ) {
    this.kv = kv;
    this.history = history;
    this.chips = chips;
    this.wallet = wallet;
  }

  setTournamentHook(hook: TournamentHandEndedHook | null): void {
    this.tournamentHook = hook;
    for (const room of this.rooms.values()) {
      room.setTournamentHook(hook);
    }
  }

  setPublicLobbyChangeHandler(handler: (() => void) | null): void {
    this.onPublicLobbyChange = handler;
    for (const room of this.rooms.values()) {
      room.setSeatingChangeHandler(handler);
    }
  }

  private firePublicLobbyChange(): void {
    this.onPublicLobbyChange?.();
  }

  create(opts: {
    name: string;
    hostUserId: string;
    config: TableConfig;
    isPrivate: boolean;
    stakeId?: string;
    /** Optional custom numerical invite code. */
    inviteCode?: string;
    tournament?: TournamentTableRules;
    /** Free practice chips (private host + bots). */
    playMoney?: boolean;
  }): TableMeta {
    const inviteCode = opts.inviteCode ?? this.allocateInviteCode();
    if (this.byInvite.has(inviteCode)) {
      throw new Error('Room code already in use');
    }
    const id = nanoid(10);
    const meta: TableMeta = {
      id,
      inviteCode,
      name: opts.name,
      hostUserId: opts.hostUserId,
      isPrivate: opts.isPrivate,
      stakeId: opts.stakeId,
      config: opts.config,
      createdAt: Date.now(),
      tournament: opts.tournament,
      playMoney: opts.playMoney || undefined,
    };
    const room = new Room(
      meta,
      this.kv,
      this.history,
      this.tournamentHook,
      this.chips,
      this.wallet,
      this.onPublicLobbyChange,
    );
    this.rooms.set(id, room);
    this.byInvite.set(inviteCode, id);
    void this.history.recordTable(meta);
    if (!meta.isPrivate && meta.stakeId) {
      this.firePublicLobbyChange();
    }
    return meta;
  }

  /** 6-digit numerical room code, unique among live tables. */
  private allocateInviteCode(): string {
    for (let i = 0; i < 32; i++) {
      const code = String(100_000 + Math.floor(Math.random() * 900_000));
      if (!this.byInvite.has(code)) return code;
    }
    throw new Error('Could not allocate room code');
  }

  /** Fold/stand and detach this user from every live room. */
  leaveUser(userId: string): void {
    for (const room of this.rooms.values()) {
      room.leave(userId);
    }
  }

  get(tableId: string): Room | undefined {
    return this.rooms.get(tableId);
  }

  getByInvite(code: string): Room | undefined {
    const id = this.byInvite.get(code);
    return id ? this.rooms.get(id) : undefined;
  }

  findPublicByStake(stakeId: string): Room | undefined {
    return [...this.rooms.values()].find(
      (r) => !r.meta.isPrivate && r.meta.stakeId === stakeId,
    );
  }

  /** Drop a live room immediately (caller may re-seed public tables). */
  destroy(tableId: string, message?: string): boolean {
    const room = this.rooms.get(tableId);
    if (!room) return false;
    const wasPublic = !room.meta.isPrivate && Boolean(room.meta.stakeId);
    room.shutdown(message);
    this.rooms.delete(tableId);
    this.byInvite.delete(room.meta.inviteCode);
    if (wasPublic) this.firePublicLobbyChange();
    return true;
  }

  /**
   * Shut down cash/public rooms idle for {@link ROOM_INACTIVITY_MS}.
   * Returns closed table ids (tournament rooms are never removed here).
   */
  terminateIdleRooms(
    now: number = Date.now(),
    inactivityMs: number = ROOM_INACTIVITY_MS,
  ): string[] {
    const closed: string[] = [];
    for (const room of [...this.rooms.values()]) {
      if (!room.isIdle(inactivityMs, now)) continue;
      const id = room.meta.id;
      if (this.destroy(id, 'Table closed due to inactivity')) {
        closed.push(id);
      }
    }
    return closed;
  }

  listPublicLobby(): {
    tableId: string;
    inviteCode: string;
    name: string;
    stakeId: string;
    seatedCount: number;
    maxSeats: number;
    config: TableConfig;
  }[] {
    return [...this.rooms.values()]
      .filter((r) => !r.meta.isPrivate && r.meta.stakeId)
      .sort((a, b) => (a.meta.stakeId ?? '').localeCompare(b.meta.stakeId ?? ''))
      .map((r) => ({
        tableId: r.meta.id,
        inviteCode: r.meta.inviteCode,
        name: r.meta.name,
        stakeId: r.meta.stakeId!,
        seatedCount: r.seatedCount(),
        maxSeats: r.meta.config.maxSeats,
        config: r.meta.config,
      }));
  }

  /** In-process rooms for admin — excludes permanent public stake lobbies. */
  listAllAdmin(inactivityMs: number = ROOM_INACTIVITY_MS): {
    tableId: string;
    inviteCode: string;
    name: string;
    isPrivate: boolean;
    stakeId: string | null;
    seatedCount: number;
    maxSeats: number;
    hostUserId: string;
    handInProgress: boolean;
    street: string;
    idle: boolean;
    playMoney: boolean;
    contestId: string | null;
    contestFrozen: boolean;
    createdAt: number;
  }[] {
    return [...this.rooms.values()]
      .filter((r) => {
        // Always-on public cash tables are not "live games" for ops.
        if (!r.meta.isPrivate && r.meta.stakeId) return false;
        return true;
      })
      .map((r) => {
        const street = r.state.street;
        const handInProgress = street !== 'waiting' && street !== 'payout';
        return {
          tableId: r.meta.id,
          inviteCode: r.meta.inviteCode,
          name: r.meta.name,
          isPrivate: r.meta.isPrivate,
          stakeId: r.meta.stakeId ?? null,
          seatedCount: r.seatedCount(),
          maxSeats: r.meta.config.maxSeats,
          hostUserId: r.meta.hostUserId,
          handInProgress,
          street,
          idle: r.isIdle(inactivityMs),
          playMoney: Boolean(r.meta.playMoney),
          contestId: r.meta.tournament?.contestId ?? null,
          contestFrozen: Boolean(r.meta.tournament?.frozen),
          createdAt: r.meta.createdAt,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}
