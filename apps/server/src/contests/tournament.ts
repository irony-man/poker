import { nanoid } from 'nanoid';
import {
  buildBlindSchedule,
  contestPlacementPrize,
  resolveHandLimit,
  type BlindLevel,
  type ContestBlindInfo,
  type ContestEntrant,
  type ContestMode,
  type ContestPendingInvite,
  type ContestPlacement,
  type ContestPlayerAssignment,
  type ContestStatus,
  type ContestView,
  validateContestFieldSize,
} from '@poker/protocol';
import { isBotUserId } from '../bot.js';
import { Room, RoomManager } from '../rooms/room.js';
import type { WalletStore } from '../wallet/wallet.constants.js';
import { UnlimitedWalletStore, WalletError } from '../wallet/wallet.store.js';

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
  /** Deprecated; ignored — contests are humans-only. */
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
  /** Always 0 — contests are humans-only (field kept for wire/state shape). */
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
  /** Invited friends awaiting registration. */
  pendingInvites: ContestPendingInvite[];
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
  /** Humans who already paid `startingStack` entry (join-time buy-in). */
  entryPaid: Set<string>;
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
  /** Humans who already received a ranking prize for this contest. */
  private prizeSettled = new Map<string, Set<string>>(); // contestId → userIds
  /** Fan-out public + mine contest lists (set by ContestsService). */
  private onListChange: ((c: ContestState) => void) | null = null;

  constructor(rooms: RoomManager, wallet: WalletStore = new UnlimitedWalletStore()) {
    this.rooms = rooms;
    this.wallet = wallet;
    rooms.setTournamentHook((room) => this.onRoomHandEnded(room));
  }

  setListChangeHandler(handler: ((c: ContestState) => void) | null): void {
    this.onListChange = handler;
  }

  private notifyListChange(c: ContestState): void {
    this.onListChange?.(c);
  }

  async create(opts: CreateContestOpts): Promise<ContestView> {
    const sizeErr = validateContestFieldSize(opts.mode, opts.fieldSize);
    if (sizeErr) throw new Error(sizeErr);
    if (opts.bigBlind < opts.smallBlind) throw new Error('bigBlind must be >= smallBlind');
    const inviteCode = opts.inviteCode ?? this.allocateInviteCode();
    if (this.byInvite.has(inviteCode)) {
      throw new Error('Room code already in use');
    }

    const handLimit = resolveHandLimit(opts.mode, opts.handLimit);
    const id = nanoid(10);
    // Contests are humans-only; ignore legacy botCount from older clients.
    const botFillMax = 0;
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
      pendingInvites: [],
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
      entryPaid: new Set(),
    };

    // Host auto-registers — collect buy-in at join time (create).
    if (!isBotUserId(opts.hostUserId)) {
      try {
        await this.wallet.debit(opts.hostUserId, opts.startingStack, 'buy_in', id);
        contest.entryPaid.add(opts.hostUserId);
      } catch (err) {
        if (err instanceof WalletError) throw new Error(err.message);
        throw err instanceof Error ? err : new Error('Could not collect entry fee');
      }
    }

    contest.entrants.push({
      userId: opts.hostUserId,
      name: opts.hostName,
      isBot: false,
      registeredAt: Date.now(),
    });

    this.contests.set(id, contest);
    this.byInvite.set(inviteCode, id);

    const view = this.toView(contest);
    this.notifyListChange(contest);
    return view;
  }

  async register(
    contestId: string,
    userId: string,
    name: string,
  ): Promise<{ ok: boolean; error?: string; contest?: ContestView }> {
    const c = this.contests.get(contestId);
    if (!c) return { ok: false, error: 'Contest not found' };
    if (c.status === 'completed') return { ok: false, error: 'Contest has ended' };
    if (c.status === 'cancelled') return { ok: false, error: 'Contest was cancelled' };
    if (c.status !== 'registering') return { ok: false, error: 'Registration closed' };
    if (c.entrants.some((e) => e.userId === userId)) {
      return { ok: true, contest: this.toView(c) };
    }
    if (c.entrants.length >= c.fieldSize) return { ok: false, error: 'Contest full' };

    const isBot = isBotUserId(userId);
    if (!isBot && !c.entryPaid.has(userId)) {
      try {
        await this.wallet.debit(userId, c.startingStack, 'buy_in', c.id);
        c.entryPaid.add(userId);
      } catch (err) {
        if (err instanceof WalletError && err.code === 'insufficient') {
          return { ok: false, error: err.message };
        }
        console.error('[wallet] contest join buy-in failed', err);
        return {
          ok: false,
          error: err instanceof WalletError ? err.message : 'Could not process buy-in',
        };
      }
    }

    c.entrants.push({
      userId,
      name,
      isBot,
      registeredAt: Date.now(),
    });
    c.pendingInvites = c.pendingInvites.filter((inv) => inv.userId !== userId);
    this.broadcast(c.id);
    this.notifyListChange(c);

    if (c.autoStart && c.entrants.length >= c.fieldSize) {
      const started = await this.startContest(c);
      if (!started.ok) {
        return { ok: true, contest: this.toView(c), error: started.error };
      }
    }

    return { ok: true, contest: this.toView(c) };
  }

  async unregister(
    contestId: string,
    userId: string,
  ): Promise<{ ok: boolean; error?: string; contest?: ContestView }> {
    const c = this.contests.get(contestId);
    if (!c) return { ok: false, error: 'Contest not found' };
    if (c.status !== 'registering') return { ok: false, error: 'Registration closed' };
    if (userId === c.hostUserId) return { ok: false, error: 'Host cannot unregister' };
    if (!c.entrants.some((e) => e.userId === userId)) {
      return { ok: true, contest: this.toView(c) };
    }

    if (c.entryPaid.has(userId) && !isBotUserId(userId)) {
      try {
        await this.wallet.credit(userId, c.startingStack, 'cash_out', c.id);
        c.entryPaid.delete(userId);
      } catch (err) {
        console.error('[wallet] contest entry refund failed', err);
        return { ok: false, error: 'Could not refund buy-in' };
      }
    }

    c.entrants = c.entrants.filter((e) => e.userId !== userId);
    this.broadcast(c.id);
    this.notifyListChange(c);
    return { ok: true, contest: this.toView(c) };
  }

  /**
   * Account deletion: refund + drop from registering contests; cancel if they hosted.
   * Running tables are vacated separately via RoomManager.leaveUser.
   */
  async removeUser(userId: string): Promise<void> {
    this.detachWatcherAll(userId);
    for (const c of [...this.contests.values()]) {
      c.pendingInvites = c.pendingInvites.filter((inv) => inv.userId !== userId);
      if (c.status !== 'registering') continue;
      if (c.hostUserId === userId) {
        await this.cancelRegistering(c);
      } else if (c.entrants.some((e) => e.userId === userId)) {
        await this.unregister(c.id, userId);
      }
    }
  }

  private async cancelRegistering(c: ContestState): Promise<void> {
    if (c.status !== 'registering') return;
    for (const paidUserId of [...c.entryPaid]) {
      if (isBotUserId(paidUserId)) continue;
      try {
        await this.wallet.credit(paidUserId, c.startingStack, 'cash_out', c.id);
      } catch (err) {
        console.error('[wallet] contest cancel refund failed', err);
      }
    }
    c.entryPaid.clear();
    c.status = 'cancelled';
    c.completedAt = Date.now();
    this.broadcastEvent(c.id, {
      type: 'contest_event',
      contestId: c.id,
      event: 'contest_cancelled',
      message: 'Contest cancelled',
    });
    this.broadcast(c.id);
    this.notifyListChange(c);
  }

  async start(
    contestId: string,
    userId: string,
  ): Promise<{ ok: boolean; error?: string; contest?: ContestView }> {
    const c = this.contests.get(contestId);
    if (!c) return { ok: false, error: 'Contest not found' };
    if (userId !== c.hostUserId) return { ok: false, error: 'Only host can start' };
    if (c.status !== 'registering') return { ok: false, error: 'Already started' };

    if (c.entrants.length < 2) {
      return {
        ok: false,
        error: 'Need at least 2 players to start',
      };
    }
    if (c.entrants.length > 9) return { ok: false, error: 'Contest needs 2–9 entrants' };

    // Buy-in was collected on join; refuse if a human still somehow unpaid.
    for (const e of c.entrants) {
      if (e.isBot || isBotUserId(e.userId)) continue;
      if (!c.entryPaid.has(e.userId)) {
        return {
          ok: false,
          error: `${e.name} has not paid the entry fee`,
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

  /**
   * Record friends invited to this contest (host-facing lobby list).
   * Merges by userId; skips anyone already registered.
   */
  recordPendingInvites(
    contestId: string,
    invites: Array<{ userId: string; name: string }>,
  ): ContestView | undefined {
    const c = this.contests.get(contestId);
    if (!c) return undefined;
    if (c.status !== 'registering') return this.toView(c);
    const now = Date.now();
    const seated = new Set(c.entrants.map((e) => e.userId));
    const byId = new Map(c.pendingInvites.map((inv) => [inv.userId, inv]));
    for (const inv of invites) {
      if (seated.has(inv.userId)) continue;
      const existing = byId.get(inv.userId);
      byId.set(inv.userId, {
        userId: inv.userId,
        name: inv.name,
        invitedAt: existing?.invitedAt ?? now,
      });
    }
    c.pendingInvites = [...byId.values()].sort((a, b) => a.invitedAt - b.invitedAt);
    this.broadcast(c.id);
    this.notifyListChange(c);
    return this.toView(c);
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

  /** All contests for admin (including private / finished). */
  listAll(): ContestView[] {
    return [...this.contests.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((c) => this.toView(c));
  }

  /** Contests still open for play (not finished/cancelled). */
  listLive(): ContestView[] {
    return [...this.contests.values()]
      .filter((c) => c.status === 'registering' || c.status === 'running')
      .sort((a, b) => b.createdAt - a.createdAt)
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

    // Entry fees are debited on join/create. Only seat stacks and start play here.
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
    this.notifyListChange(c);
    return { ok: true };
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
        handsPlayed: 0,
        handLimit: c.mode === 'rounds' ? c.handLimit : null,
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
    if (room.meta.tournament) {
      room.meta.tournament = {
        ...room.meta.tournament,
        handsPlayed: c.handsPlayed,
        handLimit: c.mode === 'rounds' ? c.handLimit : room.meta.tournament.handLimit ?? null,
      };
    }
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
        `${winner.name ?? 'Player'} wins with ${winner.stack} chips!`,
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
    const prizeWhuffies = contestPlacementPrize(place, c.entrants.length, c.startingStack);
    c.placements.push({
      userId,
      name: entrant?.name ?? 'Player',
      place,
      prizeWhuffies,
    });
    c.placements.sort((a, b) => a.place - b.place);
  }

  /** House-funded placement Whuffies (separate from residual stack cash-out). */
  private payPlacementPrizes(c: ContestState, room: Room | null): void {
    let paid = this.prizeSettled.get(c.id);
    if (!paid) {
      paid = new Set();
      this.prizeSettled.set(c.id, paid);
    }
    for (const p of c.placements) {
      if (isBotUserId(p.userId) || paid.has(p.userId)) continue;
      const amount =
        p.prizeWhuffies ?? contestPlacementPrize(p.place, c.entrants.length, c.startingStack);
      p.prizeWhuffies = amount;
      if (amount <= 0) {
        paid.add(p.userId);
        continue;
      }
      paid.add(p.userId);
      void this.wallet
        .creditWhuffies(p.userId, amount, 'contest_prize', c.tableId ?? c.id)
        .then((result) => {
          room?.notifyWallet(p.userId, { whuffieBalance: result.balance });
          const entrant = c.entrants.find((e) => e.userId === p.userId);
          room?.systemChatPublic(
            'Dealer',
            `${entrant?.name ?? p.name} earned ${amount} Whuffies for ${p.place}${this.ordinalSuffix(p.place)} place`,
          );
        })
        .catch((err) => {
          console.error('[wallet] contest Whuffie prize failed', err);
          paid!.delete(p.userId);
        });
    }
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
    this.payPlacementPrizes(c, tableRoom);
    // Drop table assignments so clients stop routing back into the finished table.
    c.activeTableByUser.clear();
    if (tableRoom && !tableRoom.meta.tournament?.frozen) {
      tableRoom.freezeTournamentMatch();
    }
    this.broadcastEvent(c.id, {
      type: 'contest_event',
      contestId: c.id,
      event: 'contest_completed',
      message: 'Contest completed',
    });
    this.broadcast(c.id);
    this.notifyListChange(c);
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
      pendingInvites: c.pendingInvites.map((inv) => ({
        userId: inv.userId,
        name: inv.name,
        invitedAt: inv.invitedAt,
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
