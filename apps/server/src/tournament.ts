import { nanoid } from 'nanoid';
import {
  buildBlindSchedule,
  type BlindLevel,
  type ContestBlindInfo,
  type ContestEntrant,
  type ContestMode,
  type ContestPlacement,
  type ContestPlayerAssignment,
  type ContestStatus,
  type ContestView,
  type KnockoutMatch,
  validateContestFieldSize,
} from '@poker/protocol';
import { isBotUserId, makeBotUserId, pickBotName } from './bot.js';
import { Room, RoomManager } from './room.js';

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
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  turnTimeMs: number;
  isPrivate: boolean;
  autoStart: boolean;
  entrants: ContestEntrantInternal[];
  placements: ContestPlacement[];
  matches: KnockoutMatch[];
  /** Single table for table_match. */
  tableId: string | null;
  levelIndex: number;
  handsAtLevel: number;
  schedule: BlindLevel[];
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  /** userId → current table (active match). */
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

  constructor(rooms: RoomManager) {
    this.rooms = rooms;
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

    const id = nanoid(10);
    const contest: ContestState = {
      id,
      inviteCode,
      name: opts.name,
      mode: opts.mode,
      status: 'registering',
      hostUserId: opts.hostUserId,
      fieldSize: opts.fieldSize,
      startingStack: opts.startingStack,
      smallBlind: opts.smallBlind,
      bigBlind: opts.bigBlind,
      turnTimeMs: opts.turnTimeMs,
      isPrivate: opts.isPrivate,
      autoStart: opts.autoStart,
      entrants: [],
      placements: [],
      matches: [],
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

    // Host auto-registers
    contest.entrants.push({
      userId: opts.hostUserId,
      name: opts.hostName,
      isBot: false,
      registeredAt: Date.now(),
    });

    // Pre-fill bots as registered entrants
    const botSlots = Math.max(0, Math.min(opts.botCount, opts.fieldSize - 1));
    const takenNames = new Set([opts.hostName]);
    for (let i = 0; i < botSlots; i++) {
      const name = pickBotName(takenNames);
      takenNames.add(name);
      contest.entrants.push({
        userId: makeBotUserId(nanoid(8)),
        name,
        isBot: true,
        registeredAt: Date.now(),
      });
    }

    this.contests.set(id, contest);
    this.byInvite.set(inviteCode, id);

    if (contest.autoStart && contest.entrants.length >= contest.fieldSize) {
      this.startContest(contest);
    }

    return this.toView(contest);
  }

  register(
    contestId: string,
    userId: string,
    name: string,
  ): { ok: boolean; error?: string; contest?: ContestView } {
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
      this.startContest(c);
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

  start(contestId: string, userId: string): { ok: boolean; error?: string; contest?: ContestView } {
    const c = this.contests.get(contestId);
    if (!c) return { ok: false, error: 'Contest not found' };
    if (userId !== c.hostUserId) return { ok: false, error: 'Only host can start' };
    if (c.status !== 'registering') return { ok: false, error: 'Already started' };
    if (c.entrants.length < 2) return { ok: false, error: 'Need at least 2 entrants' };
    if (c.mode === 'knockout') {
      const sizeErr = validateContestFieldSize('knockout', c.entrants.length);
      if (sizeErr && c.entrants.length !== c.fieldSize) {
        // Allow start only when field is full for knockout (bracket needs exact power-of-2)
        if (c.entrants.length !== c.fieldSize) {
          return {
            ok: false,
            error: `Knockout needs exactly ${c.fieldSize} players (have ${c.entrants.length})`,
          };
        }
      }
      if (c.entrants.length !== c.fieldSize) {
        return {
          ok: false,
          error: `Knockout needs exactly ${c.fieldSize} players (have ${c.entrants.length})`,
        };
      }
    } else if (c.entrants.length < 2 || c.entrants.length > 9) {
      return { ok: false, error: 'Table match needs 2–9 entrants' };
    }

    this.startContest(c);
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

  /** Test helper: complete a knockout match by winner user id. */
  forceCompleteMatch(contestId: string, matchId: string, winnerId: string): void {
    const c = this.contests.get(contestId);
    if (!c) return;
    this.completeKnockoutMatch(c, matchId, winnerId);
  }

  /** Test helper: eliminate a user from table-match contest. */
  forceEliminate(contestId: string, userId: string): void {
    const c = this.contests.get(contestId);
    if (!c || c.mode !== 'table_match') return;
    this.eliminatePlayers(c, [userId]);
    const alive = this.aliveEntrants(c);
    if (alive.length <= 1) {
      if (alive[0]) this.placePlayer(c, alive[0].userId, 1);
      this.finishContest(c);
    }
  }

  private startContest(c: ContestState): void {
    if (c.status !== 'registering') return;
    c.status = 'running';
    c.startedAt = Date.now();
    this.broadcastEvent(c.id, {
      type: 'contest_event',
      contestId: c.id,
      event: 'contest_started',
      message: 'Contest started',
    });

    if (c.mode === 'knockout') {
      this.startKnockout(c);
    } else {
      this.startTableMatch(c);
    }
    this.broadcast(c.id);
  }

  private startTableMatch(c: ContestState): void {
    // Field may be smaller than fieldSize if host starts early
    const n = c.entrants.length;
    const level = c.schedule[0]!;
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
        mode: 'table_match',
      },
    });
    c.tableId = meta.id;
    c.tableIds.add(meta.id);
    const room = this.rooms.get(meta.id)!;
    c.entrants.forEach((e, i) => {
      room.forceSeat(e.userId, e.name, i, c.startingStack);
      c.activeTableByUser.set(e.userId, meta.id);
    });
    this.emitMatchAssigned(c, meta.id, null, c.entrants.map((e) => e.userId));
    room.scheduleTournamentAutoStart();
  }

  private startKnockout(c: ContestState): void {
    const shuffled = [...c.entrants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    const rounds = Math.log2(c.fieldSize);
    const matches: KnockoutMatch[] = [];
    // Round 0: fieldSize/2 matches
    for (let r = 0; r < rounds; r++) {
      const count = c.fieldSize / Math.pow(2, r + 1);
      for (let i = 0; i < count; i++) {
        matches.push({
          id: nanoid(8),
          round: r,
          index: i,
          playerA: r === 0 ? shuffled[i * 2]!.userId : null,
          playerB: r === 0 ? shuffled[i * 2 + 1]!.userId : null,
          winnerId: null,
          tableId: null,
          status: 'pending',
        });
      }
    }
    c.matches = matches;
    this.launchKnockoutRound(c, 0);
  }

  private launchKnockoutRound(c: ContestState, round: number): void {
    const roundMatches = c.matches.filter((m) => m.round === round && m.status === 'pending');
    for (const match of roundMatches) {
      if (!match.playerA || !match.playerB) continue;
      this.openKnockoutMatch(c, match);
    }
  }

  private openKnockoutMatch(c: ContestState, match: KnockoutMatch): void {
    const a = c.entrants.find((e) => e.userId === match.playerA);
    const b = c.entrants.find((e) => e.userId === match.playerB);
    if (!a || !b) return;

    const level = c.schedule[Math.min(c.levelIndex, c.schedule.length - 1)]!;
    const meta = this.rooms.create({
      name: `${c.name} — R${match.round + 1} M${match.index + 1}`,
      hostUserId: c.hostUserId,
      isPrivate: true,
      config: {
        maxSeats: 2,
        smallBlind: level.smallBlind,
        bigBlind: level.bigBlind,
        buyIn: c.startingStack,
        turnTimeMs: c.turnTimeMs,
      },
      tournament: {
        contestId: c.id,
        mode: 'knockout',
        matchId: match.id,
      },
    });
    match.tableId = meta.id;
    match.status = 'active';
    c.tableIds.add(meta.id);

    const room = this.rooms.get(meta.id)!;
    room.forceSeat(a.userId, a.name, 0, c.startingStack);
    room.forceSeat(b.userId, b.name, 1, c.startingStack);
    c.activeTableByUser.set(a.userId, meta.id);
    c.activeTableByUser.set(b.userId, meta.id);

    this.emitMatchAssigned(c, meta.id, match.id, [a.userId, b.userId]);
    room.scheduleTournamentAutoStart();
  }

  private onRoomHandEnded(room: Room): void {
    const t = room.meta.tournament;
    if (!t) return;
    const c = this.contests.get(t.contestId);
    if (!c || c.status !== 'running') return;

    // Advance blind level bookkeeping for table matches (and multi-hand knockout tables)
    c.handsAtLevel += 1;
    const level = c.schedule[c.levelIndex];
    if (level && c.handsAtLevel >= level.durationHands && c.levelIndex < c.schedule.length - 1) {
      c.levelIndex += 1;
      c.handsAtLevel = 0;
      const next = c.schedule[c.levelIndex]!;
      room.applyBlindLevel(next.smallBlind, next.bigBlind);
    } else if (level) {
      // Keep current level blinds on config
      room.applyBlindLevel(
        c.schedule[c.levelIndex]!.smallBlind,
        c.schedule[c.levelIndex]!.bigBlind,
      );
    }

    if (t.mode === 'knockout' && t.matchId) {
      this.processKnockoutHand(c, room, t.matchId);
    } else if (t.mode === 'table_match') {
      this.processTableMatchHand(c, room);
    }
    this.broadcast(c.id);
  }

  private processKnockoutHand(c: ContestState, room: Room, matchId: string): void {
    const withChips = room.playersWithChips();
    if (withChips.length > 1) {
      // Continue — auto next hand
      room.scheduleTournamentAutoStart();
      return;
    }
    if (withChips.length === 1) {
      this.completeKnockoutMatch(c, matchId, withChips[0]!.userId);
      return;
    }
    // No chips? shouldn't happen — use highest stack including zeros from last state
    const seated = room.seatedPlayersSnapshot();
    seated.sort((a, b) => b.stack - a.stack);
    if (seated[0]) this.completeKnockoutMatch(c, matchId, seated[0].userId);
  }

  private processTableMatchHand(c: ContestState, room: Room): void {
    const busted = room.playersBusted();
    if (busted.length > 0) {
      // Worse places for earlier seat order among simultaneous busts
      const ordered = [...busted].sort((a, b) => a.seat - b.seat);
      this.eliminatePlayers(
        c,
        ordered.map((p) => p.userId),
      );
      for (const p of ordered) {
        room.eliminateSeat(p.seat);
      }
    }

    const alive = room.playersWithChips();
    if (alive.length <= 1) {
      if (alive[0]) {
        this.placePlayer(c, alive[0].userId, 1);
        room.systemChatPublic('Dealer', `${alive[0].name ?? 'Player'} wins the contest!`);
      }
      this.finishContest(c);
      return;
    }

    room.scheduleTournamentAutoStart();
  }

  private completeKnockoutMatch(c: ContestState, matchId: string, winnerId: string): void {
    const match = c.matches.find((m) => m.id === matchId);
    if (!match || match.status === 'completed') return;

    const loserId = match.playerA === winnerId ? match.playerB : match.playerA;
    match.winnerId = winnerId;
    match.status = 'completed';

    if (loserId) {
      const place = this.knockoutLoserPlace(c.fieldSize, match.round, match.index);
      this.placePlayer(c, loserId, place);
      c.activeTableByUser.delete(loserId);
    }
    c.activeTableByUser.delete(winnerId);

    // Freeze the room — no more hands
    if (match.tableId) {
      const room = this.rooms.get(match.tableId);
      room?.freezeTournamentMatch();
    }

    // Feed winner into next round match
    const rounds = Math.log2(c.fieldSize);
    const nextRound = match.round + 1;
    if (nextRound >= rounds) {
      // Final won
      this.placePlayer(c, winnerId, 1);
      this.finishContest(c);
      return;
    }

    const nextIndex = Math.floor(match.index / 2);
    const nextMatch = c.matches.find((m) => m.round === nextRound && m.index === nextIndex);
    if (nextMatch) {
      if (match.index % 2 === 0) nextMatch.playerA = winnerId;
      else nextMatch.playerB = winnerId;

      // Launch next match when both slots filled
      if (nextMatch.playerA && nextMatch.playerB && nextMatch.status === 'pending') {
        this.openKnockoutMatch(c, nextMatch);
      }
    }

    this.broadcast(c.id);
  }

  /**
   * Assign unique places for losers in a round.
   * Round 0 of 8: places 5–8; semis: 3–4; final loser handled separately as 2.
   */
  private knockoutLoserPlace(fieldSize: number, round: number, matchIndex: number): number {
    const high = fieldSize / Math.pow(2, round); // e.g. round0/8 → 8
    const low = fieldSize / Math.pow(2, round + 1) + 1; // → 5
    // Map match index into [low, high]
    return low + matchIndex;
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

  private finishContest(c: ContestState): void {
    c.status = 'completed';
    c.completedAt = Date.now();
    // Ensure all non-placed entrants get a place
    for (const e of c.entrants) {
      if (!c.placements.some((p) => p.userId === e.userId)) {
        const place = c.entrants.length - c.placements.length;
        this.placePlayer(c, e.userId, Math.max(1, place));
      }
    }
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

  private emitMatchAssigned(
    c: ContestState,
    tableId: string,
    matchId: string | null,
    userIds: string[],
  ): void {
    for (const userId of userIds) {
      const send = this.watchers.get(c.id)?.get(userId);
      send?.({
        type: 'contest_event',
        contestId: c.id,
        event: 'match_assigned',
        tableId,
        matchId: matchId ?? undefined,
        message: 'Your match is ready',
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
        matchId:
          c.matches.find(
            (m) =>
              m.status === 'active' && (m.playerA === e.userId || m.playerB === e.userId),
          )?.id ?? null,
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
      matches: c.matches.map((m) => ({ ...m })),
      tableId: c.tableId,
      blinds: c.status === 'running' || c.status === 'completed' ? blinds : null,
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
