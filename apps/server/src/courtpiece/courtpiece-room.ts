import { nanoid } from 'nanoid';
import {
  advanceAfterHand,
  chooseBotAction,
  cardToString,
  createMatch,
  parseCard,
  playCard,
  setReady,
  setTrump,
  sit,
  stand,
  startMatch,
  toPrivateView,
  type CourtpieceState,
  type RulesVariant,
  type SeatState,
  type TrickPlay,
} from '@poker/courtpiece-engine';
import type { CourtpiecePublicView, CourtpieceYou } from '@poker/protocol';
import { avatarIdFromUserId, clampAvatarId } from '../avatars.js';
import {
  isBotUserId,
  makeBotUserId,
  pickBotName,
  resolveBotPersonalityId,
  type BotStyleOptions,
} from '../bot.js';

export const COURTPIECE_INACTIVITY_MS = 15 * 60 * 1000;
export const COURTPIECE_IDLE_SWEEP_MS = 30_000;
const DISCONNECT_GRACE_MS = 120_000;
const CHAT_BUFFER = 80;
const BOT_TURN_MIN_MS = 450;
const BOT_TURN_MAX_MS = 1100;

export interface CourtpieceMeta {
  id: string;
  inviteCode: string;
  name: string;
  hostUserId: string;
  maxSeats: 4;
  rulesVariant: RulesVariant;
  createdAt: number;
}

export interface CourtpieceConnection {
  userId: string;
  name: string;
  avatarId: number;
  avatarUrl: string | null;
  send: (msg: unknown) => void;
}

export interface CourtpieceChatRow {
  userId: string;
  name: string;
  text: string;
  at: number;
}

type RateBucket = { count: number; resetAt: number };

function matchStatus(phase: CourtpieceState['phase']): CourtpiecePublicView['status'] {
  if (phase === 'finished') return 'finished';
  if (phase === 'lobby') return 'waiting';
  return 'playing';
}

function inLobbyOrFinished(state: CourtpieceState): boolean {
  return state.phase === 'lobby' || state.phase === 'finished';
}

export class CourtpieceRoom {
  meta: CourtpieceMeta;
  state: CourtpieceState;
  private connections = new Map<string, CourtpieceConnection>();
  private disconnectTimers = new Map<string, NodeJS.Timeout>();
  private vacateWhenLobby = new Set<string>();
  private turnTimer: NodeJS.Timeout | null = null;
  private turnEndsAt: number | null = null;
  private rateLimits = new Map<string, RateBucket>();
  private avatarByUser = new Map<string, number>();
  private avatarUrlByUser = new Map<string, string>();
  private chatLog: CourtpieceChatRow[] = [];
  private botNamePool: string[] | null = null;
  private botStyles: BotStyleOptions | null = null;
  private idleSince: number | null;
  private closed = false;

  constructor(meta: CourtpieceMeta, turnTimeMs?: number) {
    this.meta = meta;
    this.state = createMatch({
      matchId: meta.id,
      rulesVariant: meta.rulesVariant,
      turnTimeMs,
    });
    this.idleSince = meta.createdAt;
  }

  isClosed(): boolean {
    return this.closed;
  }

  attach(conn: CourtpieceConnection): void {
    if (this.closed) {
      conn.send({ type: 'error', message: 'Board closed due to inactivity', code: 'room_closed' });
      return;
    }
    this.cancelDisconnect(conn.userId);
    this.vacateWhenLobby.delete(conn.userId);
    this.connections.set(conn.userId, conn);
    this.avatarByUser.set(conn.userId, clampAvatarId(conn.avatarId));
    if (conn.avatarUrl) this.avatarUrlByUser.set(conn.userId, conn.avatarUrl);
    else this.avatarUrlByUser.delete(conn.userId);
    this.refreshIdleClock();
    this.pushTo(conn.userId);
  }

  isActiveConnection(userId: string, send: CourtpieceConnection['send']): boolean {
    return this.connections.get(userId)?.send === send;
  }

  detachIfActive(userId: string, send: CourtpieceConnection['send']): boolean {
    if (!this.isActiveConnection(userId, send)) return false;
    this.detach(userId);
    return true;
  }

  detach(userId: string): void {
    this.connections.delete(userId);
    this.refreshIdleClock();
  }

  scheduleDisconnect(userId: string): void {
    this.cancelDisconnect(userId);
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      if (this.connections.has(userId)) {
        this.refreshIdleClock();
        return;
      }
      if (inLobbyOrFinished(this.state)) this.leave(userId);
      else {
        this.vacateWhenLobby.add(userId);
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

  leave(userId: string): { ok: boolean; error?: string } {
    if (this.closed) {
      this.detach(userId);
      return { ok: true };
    }
    this.cancelDisconnect(userId);
    const seat = this.seatOf(userId);
    if (seat !== null && inLobbyOrFinished(this.state)) {
      const name = this.state.seats[seat]?.name ?? 'Player';
      const result = stand(this.state, seat);
      if (result.ok) {
        this.state = result.state;
        this.systemChat(`${name} leaves the board`);
      }
    } else if (seat !== null) {
      this.vacateWhenLobby.add(userId);
    }
    this.detach(userId);
    this.refreshIdleClock();
    this.broadcast();
    return { ok: true };
  }

  autoSit(userId: string, name: string): { ok: boolean; error?: string } {
    if (this.seatOf(userId) !== null) return { ok: true };
    const empty = this.state.seats.find((s: SeatState) => s.status === 'empty');
    if (!empty) return { ok: false, error: 'Board full' };
    return this.sit(userId, name, empty.seat);
  }

  sit(userId: string, name: string, seat: number): { ok: boolean; error?: string } {
    if (this.seatOf(userId) === seat) return { ok: true };
    const result = sit(this.state, seat, userId, name);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    const conn = this.connections.get(userId);
    if (conn) this.avatarByUser.set(userId, clampAvatarId(conn.avatarId));
    else if (!this.avatarByUser.has(userId)) {
      this.avatarByUser.set(userId, avatarIdFromUserId(userId));
    }
    this.refreshIdleClock();
    this.systemChat(`${name} sits`);
    this.afterStateChange();
    return { ok: true };
  }

  stand(userId: string, seat: number): { ok: boolean; error?: string } {
    if (this.seatOf(userId) !== seat) return { ok: false, error: 'Not your seat' };
    const name = this.state.seats[seat]?.name ?? 'Player';
    const result = stand(this.state, seat);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.refreshIdleClock();
    this.systemChat(`${name} stands`);
    this.afterStateChange();
    return { ok: true };
  }

  setReady(userId: string, ready: boolean): { ok: boolean; error?: string } {
    const seat = this.seatOf(userId);
    if (seat === null) return { ok: false, error: 'Sit first' };
    const result = setReady(this.state, seat, ready);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.tryStartMatch();
    this.tryAdvanceAfterHand();
    this.afterStateChange();
    return { ok: true };
  }

  setTrumpSuit(userId: string, suit: 'c' | 'd' | 'h' | 's', seq?: number): { ok: boolean; error?: string } {
    const seat = this.seatOf(userId);
    if (seat === null) return { ok: false, error: 'Sit first' };
    const result = setTrump(this.state, seat, suit, seq);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.systemChat(`Trump is ${suit.toUpperCase()}`);
    this.afterStateChange();
    return { ok: true };
  }

  play(userId: string, cardStr: string, seq?: number): { ok: boolean; error?: string } {
    const seat = this.seatOf(userId);
    if (seat === null) return { ok: false, error: 'Sit first' };
    let card;
    try {
      card = parseCard(cardStr);
    } catch {
      return { ok: false, error: 'Invalid card' };
    }
    const result = playCard(this.state, seat, card, seq);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.announceHandEvents(result.events);
    if (result.state.phase === 'finished' && result.state.winnerTeam != null) {
      const team = result.state.winnerTeam;
      this.systemChat(`Team ${team === 0 ? 'NS' : 'EW'} wins the match`);
    }
    this.tryAdvanceAfterHand();
    this.afterStateChange();
    return { ok: true };
  }

  addBot(
    _requestedBy: string,
    seat?: number,
    count = 1,
    namePool?: readonly string[],
    styles?: BotStyleOptions | null,
  ): { ok: boolean; error?: string; added?: number } {
    if (namePool && namePool.length > 0) this.botNamePool = [...namePool];
    if (styles) {
      this.botStyles = {
        defaultPersonality: styles.defaultPersonality ?? null,
        namePersonalities: { ...(styles.namePersonalities ?? {}) },
      };
    }
    const toAdd = seat !== undefined ? 1 : Math.max(1, Math.min(3, count));
    let added = 0;
    const joined: string[] = [];
    for (let i = 0; i < toAdd; i++) {
      const emptySeats = this.state.seats
        .filter((s: SeatState) => s.status === 'empty')
        .map((s: SeatState) => s.seat);
      if (emptySeats.length === 0) break;
      let nextSeat = emptySeats[0]!;
      if (i === 0 && seat !== undefined) {
        if (!emptySeats.includes(seat)) break;
        nextSeat = seat;
      }
      const taken = new Set(
        this.state.seats.filter((s: SeatState) => s.name).map((s: SeatState) => s.name!),
      );
      const name = pickBotName(taken, this.botNamePool ?? undefined);
      const bareId = nanoid(8);
      const personality = resolveBotPersonalityId(name, bareId, this.botStyles);
      const userId = makeBotUserId(bareId, personality);
      const result = sit(this.state, nextSeat, userId, name, { bot: true });
      if (!result.ok) break;
      this.state = result.state;
      this.avatarByUser.set(userId, avatarIdFromUserId(userId));
      joined.push(name);
      added += 1;
    }
    if (added === 0) return { ok: false, error: 'Board full' };
    this.systemChat(
      added === 1 ? `${joined[0]} joins as a bot` : `${added} bots join — ${joined.join(', ')}`,
    );
    this.tryStartMatch();
    this.afterStateChange();
    return { ok: true, added };
  }

  removeBot(seat: number): { ok: boolean; error?: string } {
    const player = this.state.seats[seat];
    if (!player || player.status === 'empty' || !player.isBot) {
      return { ok: false, error: 'No bot in that seat' };
    }
    const name = player.name ?? 'Bot';
    const result = stand(this.state, seat);
    if (!result.ok) return { ok: false, error: result.error };
    this.state = result.state;
    this.systemChat(`${name} leaves`);
    this.afterStateChange();
    return { ok: true };
  }

  chat(userId: string, name: string, text: string): void {
    if (!this.rateLimit(`${userId}:chat`, 10, 5000)) return;
    this.pushChat(userId, name, text);
  }

  listChat(limit = 80): CourtpieceChatRow[] {
    const n = Number.isFinite(limit) && limit > 0 ? Math.min(limit, CHAT_BUFFER) : 80;
    return this.chatLog.slice(-n);
  }

  toPublicView(): CourtpiecePublicView {
    return {
      id: this.meta.id,
      inviteCode: this.meta.inviteCode,
      name: this.meta.name,
      hostUserId: this.meta.hostUserId,
      maxSeats: 4,
      rulesVariant: this.meta.rulesVariant,
      status: matchStatus(this.state.phase),
      phase: this.state.phase,
      seats: this.state.seats.map((s: SeatState) => {
        const connected = s.userId ? s.isBot || this.connections.has(s.userId) : false;
        const avatarUrl = s.userId ? (this.avatarUrlByUser.get(s.userId) ?? null) : null;
        return {
          seat: s.seat,
          userId: s.userId,
          name: s.name,
          isBot: s.isBot,
          ready: s.ready,
          connected,
          avatarId: s.userId
            ? (this.avatarByUser.get(s.userId) ?? avatarIdFromUserId(s.userId))
            : undefined,
          avatarUrl,
          cardCount: s.hand.length,
          tricksThisHand: s.tricksThisHand,
          team: (s.seat % 2) as 0 | 1,
        };
      }),
      dealer: this.state.dealer,
      hakem: this.state.hakem,
      trumpSetter: this.state.trumpSetter,
      trump: this.state.trump,
      currentTrick: this.state.currentTrick.map((p: TrickPlay) => ({
        seat: p.seat,
        card: cardToString(p.card),
      })),
      trickLeader: this.state.trickLeader,
      toAct: this.state.toAct,
      teamHands: [this.state.teamHands[0], this.state.teamHands[1]],
      handsToWin: this.state.config.handsToWin,
      handNumber: this.state.handNumber,
      winnerTeam: this.state.winnerTeam,
      lastHand: this.state.lastHand
        ? {
            winningTeam: this.state.lastHand.winningTeam,
            handsAwarded: this.state.lastHand.handsAwarded,
            tricks: [this.state.lastHand.tricks[0], this.state.lastHand.tricks[1]],
          }
        : null,
      seq: this.state.actionSeq,
      turnEndsAt: this.turnEndsAt,
      turnTimeMs: this.state.config.turnTimeMs,
      createdAt: this.meta.createdAt,
    };
  }

  private youFor(userId: string): CourtpieceYou {
    const seat = this.seatOf(userId);
    if (seat === null) return { seat: null };
    const priv = toPrivateView(this.state, seat);
    if (!priv) return { seat };
    return {
      seat,
      hand: priv.hand,
      legal: priv.legal,
      partnerSeat: priv.partnerSeat,
      team: priv.team,
    };
  }

  shutdown(message = 'Board closed due to inactivity'): void {
    if (this.closed) return;
    this.closed = true;
    this.clearTurnTimer();
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    for (const conn of this.connections.values()) {
      try {
        conn.send({ type: 'error', message, code: 'room_closed' });
      } catch {
        /* ignore */
      }
    }
    this.connections.clear();
  }

  isIdle(ms: number = COURTPIECE_INACTIVITY_MS, now: number = Date.now()): boolean {
    if (this.closed) return false;
    if (this.hasHumanPresence()) return false;
    if (this.idleSince == null) return false;
    return now - this.idleSince >= ms;
  }

  private hasHumanPresence(): boolean {
    for (const userId of this.connections.keys()) {
      if (!isBotUserId(userId)) return true;
    }
    for (const s of this.state.seats) {
      if (s.userId && s.status !== 'empty' && !s.isBot) return true;
    }
    for (const userId of this.disconnectTimers.keys()) {
      if (!isBotUserId(userId)) return true;
    }
    return false;
  }

  private refreshIdleClock(now: number = Date.now()): void {
    if (this.hasHumanPresence()) this.idleSince = null;
    else if (this.idleSince == null) this.idleSince = now;
  }

  private seatOf(userId: string): number | null {
    const s = this.state.seats.find((x: SeatState) => x.userId === userId);
    return s ? s.seat : null;
  }

  private tryStartMatch(): void {
    const hasHuman = this.state.seats.some((s: SeatState) => s.status === 'seated' && !s.isBot);
    if (!hasHuman) return;
    const result = startMatch(this.state);
    if (!result.ok) return;
    this.state = result.state;
    this.systemChat('Match started');
  }

  private tryAdvanceAfterHand(): void {
    if (this.state.phase !== 'between_hands') return;
    const result = advanceAfterHand(this.state);
    if (!result.ok) return;
    this.state = result.state;
    this.systemChat(`Hand ${this.state.handNumber} started`);
  }

  private announceHandEvents(
    events: { type: string; winningTeam?: 0 | 1; handsAwarded?: number }[],
  ): void {
    for (const ev of events) {
      if (ev.type !== 'hand_scored' || ev.winningTeam == null || ev.handsAwarded == null) continue;
      const team = ev.winningTeam === 0 ? 'NS' : 'EW';
      const bonus = ev.handsAwarded > 1 ? ` (+${ev.handsAwarded})` : '';
      this.systemChat(`${team} wins the hand${bonus}`);
    }
  }

  private afterStateChange(): void {
    this.vacateDisconnectedIfLobby();
    this.armTurnTimer();
    this.refreshIdleClock();
    this.broadcast();
  }

  private vacateDisconnectedIfLobby(): void {
    if (!inLobbyOrFinished(this.state) || this.vacateWhenLobby.size === 0) return;
    for (const userId of [...this.vacateWhenLobby]) {
      if (this.connections.has(userId)) {
        this.vacateWhenLobby.delete(userId);
        continue;
      }
      const seat = this.seatOf(userId);
      this.vacateWhenLobby.delete(userId);
      if (seat === null) continue;
      const result = stand(this.state, seat);
      if (result.ok) this.state = result.state;
    }
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
    const phase = this.state.phase;
    if (this.state.toAct === null) return;
    if (phase !== 'playing' && phase !== 'choosing_trump') return;
    const seat = this.state.toAct;
    const actor = this.state.seats[seat];
    if (actor?.isBot) {
      const delay =
        BOT_TURN_MIN_MS + Math.floor(Math.random() * (BOT_TURN_MAX_MS - BOT_TURN_MIN_MS));
      this.turnEndsAt = Date.now() + delay;
      this.turnTimer = setTimeout(() => this.runBotTurn(seat), delay);
      return;
    }
    const ms = this.state.config.turnTimeMs;
    this.turnEndsAt = Date.now() + ms;
    this.turnTimer = setTimeout(() => this.onHumanTimeout(seat), ms);
  }

  private runBotTurn(seat: number): void {
    if (this.state.toAct !== seat) return;
    const actor = this.state.seats[seat];
    if (!actor?.isBot) return;
    const intent = chooseBotAction(this.state);
    if (intent.type === 'set_trump') {
      const result = setTrump(this.state, seat, intent.suit);
      if (result.ok) {
        this.state = result.state;
        this.systemChat(`Trump is ${intent.suit.toUpperCase()}`);
        this.afterStateChange();
      }
      return;
    }
    if (intent.type === 'play') {
      const result = playCard(this.state, seat, intent.card);
      if (result.ok) {
        this.state = result.state;
        this.announceHandEvents(result.events);
        if (result.state.phase === 'finished' && result.state.winnerTeam != null) {
          this.systemChat(`Team ${result.state.winnerTeam === 0 ? 'NS' : 'EW'} wins the match`);
        }
        this.tryAdvanceAfterHand();
        this.afterStateChange();
      }
    }
  }

  private onHumanTimeout(seat: number): void {
    if (this.state.toAct !== seat) return;
    const intent = chooseBotAction(this.state);
    if (intent.type === 'set_trump') {
      const result = setTrump(this.state, seat, intent.suit);
      if (result.ok) {
        this.state = result.state;
        this.afterStateChange();
      }
      return;
    }
    if (intent.type === 'play') {
      const result = playCard(this.state, seat, intent.card);
      if (result.ok) {
        this.state = result.state;
        this.announceHandEvents(result.events);
        if (result.state.phase === 'finished' && result.state.winnerTeam != null) {
          this.systemChat(`Team ${result.state.winnerTeam === 0 ? 'NS' : 'EW'} wins the match`);
        }
        this.tryAdvanceAfterHand();
        this.afterStateChange();
      }
    }
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

  private pushChat(userId: string, name: string, text: string): void {
    const at = Date.now();
    this.chatLog.push({ userId, name, text, at });
    if (this.chatLog.length > CHAT_BUFFER) this.chatLog.splice(0, this.chatLog.length - CHAT_BUFFER);
    const msg = {
      type: 'courtpiece_chat' as const,
      courtpieceId: this.meta.id,
      userId,
      name,
      text,
      at,
    };
    for (const conn of this.connections.values()) conn.send(msg);
  }

  private systemChat(text: string): void {
    this.pushChat('system', 'Board', text);
  }

  private pushTo(userId: string): void {
    const conn = this.connections.get(userId);
    if (!conn) return;
    conn.send({
      type: 'courtpiece_state_sync',
      courtpiece: this.toPublicView(),
      you: this.youFor(userId),
    });
  }

  private broadcast(): void {
    for (const userId of this.connections.keys()) this.pushTo(userId);
  }
}

export type InviteTakenFn = (code: string) => boolean;

export class CourtpieceRoomManager {
  private rooms = new Map<string, CourtpieceRoom>();
  private byInvite = new Map<string, string>();
  private externalInviteTaken: InviteTakenFn = () => false;

  setExternalInviteTaken(fn: InviteTakenFn): void {
    this.externalInviteTaken = fn;
  }

  create(opts: {
    name: string;
    hostUserId: string;
    rulesVariant: RulesVariant;
    inviteCode?: string;
    turnTimeMs?: number;
  }): CourtpieceMeta {
    const inviteCode = opts.inviteCode ?? this.allocateInviteCode();
    if (this.isInviteTaken(inviteCode)) throw new Error('Room code already in use');
    const id = nanoid(10);
    const meta: CourtpieceMeta = {
      id,
      inviteCode,
      name: opts.name,
      hostUserId: opts.hostUserId,
      maxSeats: 4,
      rulesVariant: opts.rulesVariant,
      createdAt: Date.now(),
    };
    this.rooms.set(id, new CourtpieceRoom(meta, opts.turnTimeMs));
    this.byInvite.set(inviteCode, id);
    return meta;
  }

  get(id: string): CourtpieceRoom | undefined {
    return this.rooms.get(id);
  }

  getByInvite(code: string): CourtpieceRoom | undefined {
    const id = this.byInvite.get(code);
    return id ? this.rooms.get(id) : undefined;
  }

  hasInvite(code: string): boolean {
    return this.byInvite.has(code);
  }

  leaveUser(userId: string): void {
    for (const room of this.rooms.values()) room.leave(userId);
  }

  destroy(id: string, message?: string): boolean {
    const room = this.rooms.get(id);
    if (!room) return false;
    room.shutdown(message);
    this.rooms.delete(id);
    this.byInvite.delete(room.meta.inviteCode);
    return true;
  }

  terminateIdleRooms(
    now: number = Date.now(),
    inactivityMs: number = COURTPIECE_INACTIVITY_MS,
  ): string[] {
    const closed: string[] = [];
    for (const room of [...this.rooms.values()]) {
      if (!room.isIdle(inactivityMs, now)) continue;
      if (this.destroy(room.meta.id, 'Board closed due to inactivity')) closed.push(room.meta.id);
    }
    return closed;
  }

  private isInviteTaken(code: string): boolean {
    return this.byInvite.has(code) || this.externalInviteTaken(code);
  }

  private allocateInviteCode(): string {
    for (let i = 0; i < 32; i++) {
      const code = String(100_000 + Math.floor(Math.random() * 900_000));
      if (!this.isInviteTaken(code)) return code;
    }
    throw new Error('Could not allocate room code');
  }
}
