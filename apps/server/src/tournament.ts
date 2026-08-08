import { nanoid } from 'nanoid';
import {
  buildBlindSchedule,
  resolveHandLimit,
  type BlindLevel,
  type ContestBlindInfo,
  type ContestEntrant,
  type ContestMode,
  type ContestPlacement,
  type ContestPlayerAssignment,
  type ContestStatus,
  type ContestView,
  validateContestFieldSize,
} from '@poker/protocol';
import { isBotUserId, makeBotUserId, pickBotName } from './bot.js';
import { Room, RoomManager } from './room.js';
import type { WalletStore } from './wallet.js';
import { UnlimitedWalletStore, WalletError } from './wallet.js';

export interface CreateContestOpts {
  name: string;
  mode: ContestMode;
  hostUserId: string;
  hostName: string;
  fieldSize: number;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  turnTimeMs: number;
  botCount: number;
  isPrivate: boolean;
  inviteCode?: string;
  autoStart: boolean;
  handLimit?: number;
}

export interface ContestEntrantInternal extends ContestEntrant {
  isBot: boolean;
}

export interface ContestState {
  id: string;
  inviteCode: string;
  name: string;
  mode: ContestMode;
  status: ContestStatus;
  hostUserId: string;
  fieldSize: number;
  /** Max bots to seat when starting if seats are still open. */
  botFillMax: number;
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  turnTimeMs: number;
  isPrivate: boolean;
  autoStart: boolean;
  /** Fixed hands for rounds mode; null for chips. */
  handLimit: number | null;
  handsPlayed: number;
  entrants: ContestEntrantInternal[];
  placements: ContestPlacement[];
  tableId: string | null;
  levelIndex: number;
  handsAtLevel: number;
  schedule: BlindLevel[];
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  /** userId → current table. */
  activeTableByUser: Map<string, string>;
  /** Tables owned by this contest. */
  tableIds: Set<string>;
}

type SendFn = (msg: unknown) => void;

export class TournamentManager {
  private contests = new Map<string, ContestState>();
  private byInvite = new Map<string, string>();
  private watchers = new Map<string, Map<string, SendFn>>(); // contestId → userId → send
  private rooms: RoomManager;
  private wallet: WalletStore;
  /** Humans whose entry fee / residual stack has been settled. */
  private walletSettled = new Map<string, Set<string>>(); // contestId → userIds

  constructor(rooms: RoomManager, wallet: WalletStore = new UnlimitedWalletStore()) {
    this.rooms = rooms;
    this.wallet = wallet;
    rooms.setTournamentHook((room) => this.onRoomHandEnded(room));
  }

  create(opts: CreateContestOpts): ContestView {
    const sizeErr = validateContestFieldSize(opts.mode, opts.fieldSize);
    if (sizeErr) throw new Error(sizeErr);
    if (opts.bigBlind < opts.smallBlind) throw new Error('bigBlind must be >= smallBlind');
    if (opts.botCount >= opts.fieldSize) {
      throw new Error('botCount must leave at least one human seat');
    }

    const inviteCode = opts.inviteCode ?? this.allocateInviteCode();
    if (this.byInvite.has(inviteCode)) {
      throw new Error('Room code already in use');
    }

    const handLimit = resolveHandLimit(opts.mode, opts.handLimit);
    const id = nanoid(10);
    const botFillMax = Math.max(0, Math.min(opts.botCount, opts.fieldSize - 1));
    const contest: ContestState = {
      id,
      inviteCode,
      name: opts.name,
      mode: opts.mode,
      status: 'registering',
      hostUserId: opts.hostUserId,
      fieldSize: opts.fieldSize,
      botFillMax,
      startingStack: opts.startingStack,
      smallBlind: opts.smallBlind,
      bigBlind: opts.bigBlind,
      turnTimeMs: opts.turnTimeMs,
      isPrivate: opts.isPrivate,
      autoStart: opts.autoStart,
      handLimit,
      handsPlayed: 0,
      entrants: [],
      placements: [],
      tableId: null,
      levelIndex: 0,
      handsAtLevel: 0,
      schedule: buildBlindSchedule(opts.smallBlind, opts.bigBlind),
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      activeTableByUser: new Map(),
      tableIds: new Set(),
    };

    // Host auto-registers. Bots fill empty seats only when the contest starts.
    contest.entrants.push({
      userId: opts.hostUserId,
      name: opts.hostName,
      isBot: false,
      registeredAt: Date.now(),
    });

    this.contests.set(id, contest);
    this.byInvite.set(inviteCode, id);

    return this.toView(contest);
  }

  async register(
    contestId: string,
    userId: string,
    name: string,
  ): Promise<{ ok: boolean; error?: string; contest?: ContestView }> {
    const c = this.contests.get(contestId);
    if (!c) return { ok: false, error: 'Contest not found' };
    if (c.status !== 'registering') return { ok: false, error: 'Registration closed' };
    if (c.entrants.some((e) => e.userId === userId)) {
      return { ok: true, contest: this.toView(c) };
    }
    if (c.entrants.length >= c.fieldSize) return { ok: false, error: 'Contest full' };

    c.entrants.push({
      userId,
      name,
      isBot: isBotUserId(userId),
      registeredAt: Date.now(),
    });
    this.broadcast(c.id);

    if (c.autoStart && c.entrants.length >= c.fieldSize) {
      let canPay = true;
      for (const e of c.entrants) {
        if (e.isBot || isBotUserId(e.userId)) continue;
        if (this.wallet.getBalance(e.userId) < c.startingStack) {
          canPay = false;
          break;
        }
      }
      if (canPay) {
        const started = await this.startContest(c);
        if (!started.ok) {
          return { ok: true, contest: this.toView(c), error: started.error };
        }
      }
    }

    return { ok: true, contest: this.toView(c) };
  }

  unregister(
    contestId: string,
    userId: string,
  ): { ok: boolean; error?: string; contest?: ContestView } {
    const c = this.contests.get(contestId);
    if (!c) return { ok: false, error: 'Contest not found' };
    if (c.status !== 'registering') return { ok: false, error: 'Registration closed' };
    if (userId === c.hostUserId) return { ok: false, error: 'Host cannot unregister' };
    c.entrants = c.entrants.filter((e) => e.userId !== userId);
    this.broadcast(c.id);
    return { ok: true, contest: this.toView(c) };
  }

  async start(
    contestId: string,
    userId: string,
  ): Promise<{ ok: boolean; error?: string; contest?: ContestView }> {
    const c = this.contests.get(contestId);
    if (!c) return { ok: false, error: 'Contest not found' };
    if (userId !== c.hostUserId) return { ok: false, error: 'Only host can start' };
    if (c.status !== 'registering') return { ok: false, error: 'Already started' };

    this.fillEmptySeatsWithBots(c);
    if (c.entrants.length < 2) {
      return {
        ok: false,
        error: 'Need at least 2 entrants — invite friends or add fill bots',
      };
    }
    if (c.entrants.length > 9) return { ok: false, error: 'Contest needs 2–9 entrants' };

    for (const e of c.entrants) {
      if (e.isBot || isBotUserId(e.userId)) continue;
      const bal = this.wallet.getBalance(e.userId);
      if (bal < c.startingStack) {
        return {
          ok: false,
          error: `${e.name} needs ${c.startingStack} Wuffies (has ${bal})`,
        };
      }
    }

    const started = await this.startContest(c);
    if (!started.ok) return { ok: false, error: started.error, contest: this.toView(c) };
    return { ok: true, contest: this.toView(c) };
  }

  get(contestId: string): ContestView | undefined {
    const c = this.contests.get(contestId);
    return c ? this.toView(c) : undefined;
  }

  getByInvite(code: string): ContestView | undefined {
    const id = this.byInvite.get(code);
    return id ? this.get(id) : undefined;
  }

  listPublic(): ContestView[] {
    return [...this.contests.values()]
      .filter((c) => !c.isPrivate && c.status === 'registering')
      .map((c) => this.toView(c));
  }

  /** Contests the user hosts or is registered in (active first). */
  listForUser(userId: string): ContestView[] {
    return [...this.contests.values()]
      .filter(
        (c) =>
          c.status !== 'cancelled' &&
          (c.hostUserId === userId || c.entrants.some((e) => e.userId === userId)),
      )
      .sort((a, b) => {
        const rank = (s: ContestStatus) =>
          s === 'registering' ? 0 : s === 'running' ? 1 : 2;
        const d = rank(a.status) - rank(b.status);
        if (d !== 0) return d;
        return b.createdAt - a.createdAt;
      })
      .map((c) => this.toView(c));
  }

  attachWatcher(contestId: string, userId: string, send: SendFn): boolean {
    if (!this.contests.has(contestId)) return false;
    let map = this.watchers.get(contestId);
    if (!map) {
      map = new Map();
      this.watchers.set(contestId, map);
    }
    map.set(userId, send);
    send({ type: 'contest_sync', contest: this.toView(this.contests.get(contestId)!) });
    return true;
  }

  detachWatcher(contestId: string, userId: string): void {
    this.watchers.get(contestId)?.delete(userId);
  }

  detachWatcherAll(userId: string): void {
    for (const map of this.watchers.values()) {
      map.delete(userId);
    }
  }

  /** Test helper: eliminate a user from a chips contest. */
  forceEliminate(contestId: string, userId: string): void {
    const c = this.contests.get(contestId);
    if (!c || c.mode !== 'chips') return;
    this.eliminatePlayers(c, [userId]);
    this.settleStack(c, userId, 0);
    const alive = this.aliveEntrants(c);
    if (alive.length <= 1) {
      if (alive[0]) this.placePlayer(c, alive[0].userId, 1);
      this.finishContest(c);
    }
  }

  /** Test helper: run post-hand contest bookkeeping as if a room hand ended. */
  forceHandEnded(contestId: string): void {
    const c = this.contests.get(contestId);
    if (!c?.tableId) return;
    const room = this.rooms.get(c.tableId);
    if (!room) return;
    this.onRoomHandEnded(room);
  }

  private async startContest(c: ContestState): Promise<{ ok: boolean; error?: string }> {
    if (c.status !== 'registering') return { ok: false, error: 'Already started' };

    const humans = c.entrants.filter((e) => !e.isBot && !isBotUserId(e.userId));
    const debited: string[] = [];
    try {
      for (const e of humans) {
        await this.wallet.debit(e.userId, c.startingStack, 'buy_in', c.id);
        debited.push(e.userId);
      }
    } catch (err) {
      for (const userId of debited) {
        try {
          await this.wallet.credit(userId, c.startingStack, 'cash_out', c.id);
        } catch (refundErr) {
          console.error('[wallet] contest entry refund failed', refundErr);
        }
      }
      const msg =
        err instanceof WalletError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not collect entry fees';
      return { ok: false, error: msg };
    }

    c.status = 'running';
    c.startedAt = Date.now();
    this.walletSettled.set(c.id, new Set());
    this.broadcastEvent(c.id, {
      type: 'contest_event',
      contestId: c.id,
      event: 'contest_started',
      message: 'Contest started',
    });
    this.openTable(c);
    this.broadcast(c.id);
    return { ok: true };
  }

  /**
   * Seat bots into remaining spots up to botFillMax when the host starts
   * without a full human field.
   */
  private fillEmptySeatsWithBots(c: ContestState): void {
    const open = Math.max(0, c.fieldSize - c.entrants.length);
    if (open === 0 || c.botFillMax <= 0) return;
    const existingBots = c.entrants.filter((e) => e.isBot).length;
    const botsToAdd = Math.min(open, Math.max(0, c.botFillMax - existingBots));
    if (botsToAdd <= 0) return;

    const takenNames = new Set(c.entrants.map((e) => e.name));
    for (let i = 0; i < botsToAdd; i++) {
      const name = pickBotName(takenNames);
      takenNames.add(name);
      c.entrants.push({
        userId: makeBotUserId(nanoid(8)),
        name,
        isBot: true,
        registeredAt: Date.now(),
      });
    }
  }

  private openTable(c: ContestState): void {
    const n = c.entrants.length;
    const level = c.schedule[0]!;
    const allowTopUp = c.mode === 'rounds';
    const meta = this.rooms.create({
      name: `${c.name} — Table`,
      hostUserId: c.hostUserId,
      isPrivate: true,
      config: {
        maxSeats: n,
        smallBlind: level.smallBlind,
        bigBlind: level.bigBlind,
        buyIn: c.startingStack,
        turnTimeMs: c.turnTimeMs,
      },
      tournament: {
        contestId: c.id,
        mode: c.mode,
        allowTopUp,
      },
    });
    c.tableId = meta.id;
    c.tableIds.add(meta.id);
    const room = this.rooms.get(meta.id)!;
    c.entrants.forEach((e, i) => {
      room.forceSeat(e.userId, e.name, i, c.startingStack);
      c.activeTableByUser.set(e.userId, meta.id);
    });
    this.emitMatchAssigned(c, meta.id, c.entrants.map((e) => e.userId));
    room.scheduleTournamentAutoStart();
  }

  private settleStack(c: ContestState, userId: string, stack: number): void {
    if (isBotUserId(userId)) return;
    let set = this.walletSettled.get(c.id);
    if (!set) {
      set = new Set();
      this.walletSettled.set(c.id, set);
    }
    if (set.has(userId)) return;
    set.add(userId);
    const amount = Math.max(0, Math.floor(stack));
    if (amount <= 0) return;
    void this.wallet.credit(userId, amount, 'cash_out', c.tableId ?? c.id).catch((err) => {
      console.error('[wallet] contest settle failed', err);
      set!.delete(userId);
    });
  }

  private settleAllRemaining(c: ContestState, room: Room | null): void {
    for (const e of c.entrants) {
      if (e.isBot || isBotUserId(e.userId)) continue;
      let stack = 0;
      if (room) {
        const seat = room.state.players.find((p) => p.userId === e.userId);
        stack = seat?.stack ?? 0;
      }
      this.settleStack(c, e.userId, stack);
    }
  }

  private onRoomHandEnded(room: Room): void {
    const t = room.meta.tournament;
    if (!t) return;
    const c = this.contests.get(t.contestId);
    if (!c || c.status !== 'running') return;

    c.handsPlayed += 1;
    c.handsAtLevel += 1;
    const level = c.schedule[c.levelIndex];
    if (level && c.handsAtLevel >= level.durationHands && c.levelIndex < c.schedule.length - 1) {
      c.levelIndex += 1;
      c.handsAtLevel = 0;
      const next = c.schedule[c.levelIndex]!;
      room.applyBlindLevel(next.smallBlind, next.bigBlind);
    } else if (level) {
      room.applyBlindLevel(
        c.schedule[c.levelIndex]!.smallBlind,
        c.schedule[c.levelIndex]!.bigBlind,
      );
    }

    if (c.mode === 'chips') {
      this.processChipsHand(c, room);
    } else {
      this.processRoundsHand(c, room);
    }
    this.broadcast(c.id);
  }

  private processChipsHand(c: ContestState, room: Room): void {
    const busted = room.playersBusted();
    if (busted.length > 0) {
      const ordered = [...busted].sort((a, b) => a.seat - b.seat);
      this.eliminatePlayers(
        c,
        ordered.map((p) => p.userId),
      );
      for (const p of ordered) {
        // Bust = 0 chips remaining; mark settled so finish won't double-credit.
        this.settleStack(c, p.userId, 0);
        room.eliminateSeat(p.seat);
      }
    }

    const alive = room.playersWithChips();
    if (alive.length <= 1) {
      if (alive[0]) {
        this.placePlayer(c, alive[0].userId, 1);
        room.systemChatPublic('Dealer', `${alive[0].name ?? 'Player'} wins the contest!`);
      }
      room.freezeTournamentMatch();
      this.finishContest(c, room);
      return;
    }

    room.scheduleTournamentAutoStart();
  }

  private processRoundsHand(c: ContestState, room: Room): void {
    // Bots rebuy automatically so the session keeps moving.
    room.autoTopUpBrokeBots();

    const limit = c.handLimit ?? 0;
    if (c.handsPlayed >= limit) {
      this.finishByChipLeader(c, room);
      return;
    }

    const withChips = room.playersWithChips();
    // Not enough funded players and hand budget remains — end by stack order.
    if (withChips.length < 2) {
      this.finishByChipLeader(c, room);
      return;
    }

    room.scheduleTournamentAutoStart();
  }

  /** Rank remaining seated stacks; higher chip count places better. */
  private finishByChipLeader(c: ContestState, room: Room): void {
    if (c.status !== 'running') return;
    const seated = room.seatedPlayersSnapshot();
    seated.sort((a, b) => b.stack - a.stack || a.seat - b.seat);
    seated.forEach((p, i) => {
      this.placePlayer(c, p.userId, i + 1);
    });
    const winner = seated[0];
    if (winner) {
      room.systemChatPublic(
        'Dealer',
        `${winner.name ?? 'Player'} wins with ${winner.stack} Wuffies!`,
      );
    }
    room.freezeTournamentMatch();
    this.finishContest(c, room);
  }

  private eliminatePlayers(c: ContestState, userIds: string[]): void {
    for (const userId of userIds) {
      if (c.placements.some((p) => p.userId === userId)) continue;
      // First elim among N → place N; second → N-1; …
      const already = c.placements.length;
      const elimPlace = c.entrants.length - already;
      this.placePlayer(c, userId, Math.max(2, elimPlace));
      c.activeTableByUser.delete(userId);
      const p = c.placements.find((x) => x.userId === userId);
      this.broadcastEvent(c.id, {
        type: 'contest_event',
        contestId: c.id,
        event: 'eliminated',
        message: p
          ? `Eliminated in ${p.place}${this.ordinalSuffix(p.place)} place`
          : 'Eliminated',
        place: p?.place,
      });
    }
  }

  private placePlayer(c: ContestState, userId: string, place: number): void {
    if (c.placements.some((p) => p.userId === userId)) return;
    const entrant = c.entrants.find((e) => e.userId === userId);
    c.placements.push({
      userId,
      name: entrant?.name ?? 'Player',
      place,
    });
    c.placements.sort((a, b) => a.place - b.place);
  }

  private finishContest(c: ContestState, room: Room | null = null): void {
    if (c.status === 'completed') return;
    c.status = 'completed';
    c.completedAt = Date.now();
    // Ensure all non-placed entrants get a place
    for (const e of c.entrants) {
      if (!c.placements.some((p) => p.userId === e.userId)) {
        const place = c.entrants.length - c.placements.length;
        this.placePlayer(c, e.userId, Math.max(1, place));
      }
    }
    // Credit leftover contest stacks back to each human's wallet once.
    const tableRoom =
      room ?? (c.tableId ? this.rooms.get(c.tableId) ?? null : null);
    this.settleAllRemaining(c, tableRoom);
    this.broadcastEvent(c.id, {
      type: 'contest_event',
      contestId: c.id,
      event: 'contest_completed',
      message: 'Contest completed',
    });
    this.broadcast(c.id);
  }

  private aliveEntrants(c: ContestState): ContestEntrantInternal[] {
    const placed = new Set(c.placements.map((p) => p.userId));
    return c.entrants.filter((e) => !placed.has(e.userId));
  }

  private emitMatchAssigned(c: ContestState, tableId: string, userIds: string[]): void {
    for (const userId of userIds) {
      const send = this.watchers.get(c.id)?.get(userId);
      send?.({
        type: 'contest_event',
        contestId: c.id,
        event: 'match_assigned',
        tableId,
        message: 'Your table is ready',
      });
    }
    this.broadcast(c.id);
  }

  private broadcast(contestId: string): void {
    const c = this.contests.get(contestId);
    if (!c) return;
    const view = this.toView(c);
    const map = this.watchers.get(contestId);
    if (!map) return;
    for (const send of map.values()) {
      send({ type: 'contest_sync', contest: view });
    }
  }

  private broadcastEvent(contestId: string, event: unknown): void {
    const map = this.watchers.get(contestId);
    if (!map) return;
    for (const send of map.values()) {
      send(event);
    }
  }

  private toView(c: ContestState): ContestView {
    const level = c.schedule[Math.min(c.levelIndex, c.schedule.length - 1)]!;
    const blinds: ContestBlindInfo = {
      levelIndex: c.levelIndex,
      smallBlind: level.smallBlind,
      bigBlind: level.bigBlind,
      handsAtLevel: c.handsAtLevel,
      handsUntilNext: Math.max(0, level.durationHands - c.handsAtLevel),
    };

    const assignments: ContestPlayerAssignment[] = c.entrants.map((e) => {
      const placement = c.placements.find((p) => p.userId === e.userId);
      return {
        userId: e.userId,
        tableId: c.activeTableByUser.get(e.userId) ?? null,
        matchId: null,
        eliminated: Boolean(placement) && placement!.place > 1,
        place: placement?.place ?? null,
      };
    });

    return {
      id: c.id,
      inviteCode: c.inviteCode,
      name: c.name,
      mode: c.mode,
      status: c.status,
      hostUserId: c.hostUserId,
      fieldSize: c.fieldSize,
      startingStack: c.startingStack,
      smallBlind: c.smallBlind,
      bigBlind: c.bigBlind,
      turnTimeMs: c.turnTimeMs,
      isPrivate: c.isPrivate,
      entrants: c.entrants.map((e) => ({
        userId: e.userId,
        name: e.name,
        isBot: e.isBot,
        registeredAt: e.registeredAt,
      })),
      placements: [...c.placements],
      tableId: c.tableId,
      blinds: c.status === 'running' || c.status === 'completed' ? blinds : null,
      handsPlayed: c.handsPlayed,
      handLimit: c.handLimit,
      assignments,
      createdAt: c.createdAt,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
    };
  }

  private allocateInviteCode(): string {
    for (let i = 0; i < 32; i++) {
      const code = String(100_000 + Math.floor(Math.random() * 900_000));
      if (!this.byInvite.has(code)) return code;
    }
    throw new Error('Could not allocate invite code');
  }

  private ordinalSuffix(n: number): string {
    const j = n % 10;
    const k = n % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }
}
