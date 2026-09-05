import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ClientMessageSchema, type ClientMessage } from '@poker/protocol';
import type { RawData, WebSocket } from 'ws';
import { AuthService } from '../auth/auth.service.js';
import { ContestsService } from '../contests/contests.service.js';
import { FriendsService } from '../friends/friends.service.js';
import { LudoRoomsService } from '../ludo/ludo.service.js';
import { PresenceService } from '../presence/presence.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import { WalletService } from '../wallet/wallet.service.js';

type SocketState = {
  userId: string | null;
  name: string | null;
  tableId: string | null;
  contestId: string | null;
  ludoId: string | null;
  send: (msg: unknown) => void;
};

type LudoPlayMessage = Extract<
  ClientMessage,
  {
    type:
      | 'ludo_sit'
      | 'ludo_stand'
      | 'ludo_set_ready'
      | 'ludo_roll'
      | 'ludo_move'
      | 'ludo_add_bot'
      | 'ludo_remove_bot'
      | 'ludo_chat';
  }
>;

@WebSocketGateway({ path: '/ws' })
export class PokerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PokerGateway.name);
  private readonly states = new WeakMap<WebSocket, SocketState>();

  constructor(
    private readonly auth: AuthService,
    private readonly wallet: WalletService,
    private readonly rooms: RoomsService,
    private readonly ludo: LudoRoomsService,
    private readonly contests: ContestsService,
    private readonly friends: FriendsService,
    private readonly presence: PresenceService,
    private readonly realtime: RealtimeService,
    private readonly site: SiteConfigService,
  ) {}

  handleConnection(@ConnectedSocket() client: WebSocket): void {
    const send = (msg: unknown) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(msg));
      }
    };
    this.states.set(client, {
      userId: null,
      name: null,
      tableId: null,
      contestId: null,
      ludoId: null,
      send,
    });
    this.realtime.registerSocket(send);
    // Fresh public lobby lists (tables may have just changed while connected clients idle).
    this.realtime.setPublicTables(this.rooms.listPublicLobby());
    this.realtime.setPublicContests(this.contests.listPublic());
    this.realtime.sendPublicLobby(send);
    client.on('message', (raw: RawData) => {
      void this.handleMessage(client, raw);
    });
  }

  handleDisconnect(@ConnectedSocket() client: WebSocket): void {
    const st = this.states.get(client);
    if (!st) return;
    const { userId, tableId, contestId, ludoId, send } = st;
    if (userId && tableId) {
      const room = this.rooms.get(tableId);
      if (room?.detachIfActive(userId, send)) {
        room.scheduleDisconnect(userId);
      }
    }
    if (userId && ludoId) {
      const board = this.ludo.get(ludoId);
      if (board?.detachIfActive(userId, send)) {
        board.scheduleDisconnect(userId);
      }
    }
    if (userId && contestId) {
      this.contests.detachWatcher(contestId, userId);
    } else if (userId) {
      this.contests.detachWatcherAll(userId);
    }
    const lastSocket = this.realtime.unregisterSocket(send, userId);
    if (userId && lastSocket) {
      this.presence.clear(userId);
      void this.realtime.pushSocialToFriendsOf(userId);
    }
    this.states.delete(client);
  }

  private async handleMessage(client: WebSocket, raw: RawData): Promise<void> {
    const st = this.states.get(client);
    if (!st) return;
    const { send } = st;

    let data: unknown;
    try {
      data = JSON.parse(String(raw));
    } catch {
      send({ type: 'error', message: 'Invalid JSON', code: 'bad_json' });
      return;
    }

    const parsed = ClientMessageSchema.safeParse(data);
    if (!parsed.success) {
      send({ type: 'error', message: 'Invalid message', code: 'bad_schema' });
      return;
    }
    const msg = parsed.data;

    if (msg.type === 'ping') {
      send({ type: 'pong' });
      if (st.userId) this.presence.touch(st.userId);
      return;
    }

    if (msg.type === 'auth') {
      const user = this.auth.consumeTicket(msg.ticket);
      if (!user) {
        send({ type: 'error', message: 'Invalid or expired ticket', code: 'bad_auth' });
        return;
      }
      const wasOnline = this.presence.isOnline(user.id) || this.realtime.isUserConnected(user.id);
      st.userId = user.id;
      st.name = user.name;
      void this.wallet.ensureStartingBalance(user.id);
      void this.wallet.ensureStartingWhuffies(user.id);
      this.presence.touch(user.id);
      const firstSocket = this.realtime.registerUser(user.id, send);
      send({
        type: 'auth_ok',
        userId: user.id,
        name: user.name,
        avatarId: user.avatarId,
        avatarUrl: user.avatarUrl,
        chipBalance: this.wallet.getBalance(user.id),
        whuffieBalance: this.wallet.getWhuffieBalance(user.id),
      });
      await this.realtime.sendAuthSnapshots(user.id, send);
      if (firstSocket && !wasOnline) {
        void this.realtime.pushSocialToFriendsOf(user.id);
      }
      return;
    }

    if (!st.userId || !st.name) {
      send({ type: 'error', message: 'Authenticate first', code: 'auth' });
      return;
    }

    const userId = st.userId;
    this.presence.touch(userId);
    const name = st.name;

    if (msg.type === 'join_contest') {
      if (st.contestId && st.contestId !== msg.contestId) {
        this.contests.detachWatcher(st.contestId, userId);
      }
      const ok = this.contests.attachWatcher(msg.contestId, userId, send);
      if (!ok) {
        send({ type: 'error', message: 'Contest not found', code: 'not_found' });
        return;
      }
      st.contestId = msg.contestId;
      return;
    }

    if (msg.type === 'leave_contest') {
      this.contests.detachWatcher(msg.contestId, userId);
      if (st.contestId === msg.contestId) st.contestId = null;
      return;
    }

    if (msg.type === 'join_ludo') {
      const board = this.ludo.get(msg.ludoId);
      if (!board) {
        send({
          type: 'error',
          message: 'Board not found — server may have restarted. Create a new board from the lobby.',
          code: 'not_found',
        });
        return;
      }
      if (st.tableId) {
        this.rooms.get(st.tableId)?.leave(userId);
        st.tableId = null;
      }
      if (st.ludoId && st.ludoId !== msg.ludoId) {
        this.ludo.get(st.ludoId)?.leave(userId);
      }
      st.ludoId = msg.ludoId;
      const authUser = this.auth.getUser(userId);
      const avatarId = authUser?.avatarId ?? 0;
      const avatarUrl = authUser?.avatarUrl ?? null;
      board.attach({ userId, name, avatarId, avatarUrl, send });
      if (!msg.spectate) {
        const seated = board.autoSit(userId, name);
        if (!seated.ok && seated.error && seated.error !== 'Board full') {
          send({ type: 'error', message: seated.error, code: 'sit_failed' });
        }
      }
      return;
    }

    if (msg.type === 'leave_ludo') {
      this.ludo.get(msg.ludoId)?.leave(userId);
      if (st.ludoId === msg.ludoId) st.ludoId = null;
      return;
    }

    if (
      msg.type === 'ludo_sit' ||
      msg.type === 'ludo_stand' ||
      msg.type === 'ludo_set_ready' ||
      msg.type === 'ludo_roll' ||
      msg.type === 'ludo_move' ||
      msg.type === 'ludo_add_bot' ||
      msg.type === 'ludo_remove_bot' ||
      msg.type === 'ludo_chat'
    ) {
      this.dispatchLudo(userId, name, msg, send);
      return;
    }

    if (msg.type === 'join_table') {
      if (st.ludoId) {
        this.ludo.get(st.ludoId)?.leave(userId);
        st.ludoId = null;
      }
      const room = this.rooms.get(msg.tableId);
      if (!room) {
        send({
          type: 'error',
          message: 'Table not found — server may have restarted. Create a new table from the lobby.',
          code: 'not_found',
        });
        return;
      }
      if (room.meta.tournament?.frozen) {
        send({
          type: 'error',
          message: 'Contest has ended',
          code: 'contest_ended',
        });
        return;
      }
      if (st.tableId) {
        this.rooms.get(st.tableId)?.detach(userId);
      }
      st.tableId = msg.tableId;
      const authUser = this.auth.getUser(userId);
      const avatarId = authUser?.avatarId ?? 0;
      const avatarUrl = authUser?.avatarUrl ?? null;
      room.attach({ userId, name, avatarId, avatarUrl, send });
      if (!msg.spectate) {
        const seated = await room.autoSit(userId, name);
        if (!seated.ok && seated.error && seated.error !== 'Table full') {
          if (seated.error !== 'Tournament seats are assigned') {
            send({ type: 'error', message: seated.error, code: 'sit_failed' });
          }
        }
      }
      return;
    }

    if (msg.type === 'leave_table') {
      this.rooms.get(msg.tableId)?.leave(userId);
      if (st.tableId === msg.tableId) st.tableId = null;
      return;
    }

    if (!('tableId' in msg)) return;
    const r = this.rooms.get(msg.tableId);
    if (!r) {
      send({ type: 'error', message: 'Table not found', code: 'not_found' });
      return;
    }

    switch (msg.type) {
      case 'sit': {
        const result = await r.sit(userId, name, msg.seat, msg.buyIn);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Sit failed' });
        break;
      }
      case 'stand': {
        const result = r.stand(userId, msg.seat);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Stand failed' });
        break;
      }
      case 'sit_out': {
        const result = r.doSitOut(userId, msg.seat);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Sit out failed' });
        break;
      }
      case 'sit_in': {
        const result = r.doSitIn(userId, msg.seat);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Sit in failed' });
        break;
      }
      case 'top_up': {
        const result = await r.doTopUp(userId, msg.seat, msg.amount);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Top-up failed' });
        break;
      }
      case 'start_hand': {
        const result = r.startHand(userId);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Start failed' });
        break;
      }
      case 'set_ready': {
        const result = r.setReady(userId, msg.ready);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Ready failed' });
        break;
      }
      case 'kick_player': {
        const result = await r.kickPlayer(userId, msg.seat);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Kick failed' });
        break;
      }
      case 'action': {
        const result = r.action(userId, msg.handId, msg.seq, msg.action, msg.amount);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Action failed' });
        break;
      }
      case 'chat':
        r.chat(userId, name, msg.text);
        break;
      case 'emoji':
        r.emoji(userId, name, msg.emoji);
        break;
      case 'add_bot': {
        if (r.isTournament()) {
          send({ type: 'error', message: 'Cannot add bots mid-tournament' });
          break;
        }
        // Prefer explicit group; else keep table pool from create; else site default.
        let namePool: string[] | undefined;
        let styles: ReturnType<SiteConfigService['getBotSeatingConfig']> | undefined;
        if (msg.botGroupId) {
          const seating = this.site.getBotSeatingConfig(msg.botGroupId);
          namePool = seating.names;
          styles = seating;
        } else if (!r.getBotNamePool()) {
          const seating = this.site.getBotSeatingConfig();
          namePool = seating.names;
          styles = seating;
        } else if (!r.getBotStyles()) {
          styles = this.site.getBotSeatingConfig();
        }
        const result = r.addBot(userId, msg.seat, msg.buyIn, msg.count ?? 1, namePool, styles);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Add bot failed' });
        break;
      }
      case 'remove_bot': {
        if (r.isTournament()) {
          send({ type: 'error', message: 'Cannot remove bots mid-tournament' });
          break;
        }
        const result = r.removeBot(msg.seat);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Remove bot failed' });
        break;
      }
      case 'remove_all_bots': {
        if (r.isTournament()) {
          send({ type: 'error', message: 'Cannot remove bots mid-tournament' });
          break;
        }
        const result = r.removeAllBots();
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Remove bots failed' });
        break;
      }
      case 'voice_join': {
        const result = r.joinVoice(userId, name);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Voice join failed' });
        break;
      }
      case 'voice_leave':
        r.leaveVoice(userId);
        break;
      case 'voice_signal': {
        const result = r.relayVoiceSignal(userId, msg.toUserId, msg.signal);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Voice signal failed' });
        break;
      }
      default:
        break;
    }
  }

  private dispatchLudo(
    userId: string,
    name: string,
    msg: LudoPlayMessage,
    send: (msg: unknown) => void,
  ): void {
    const board = this.ludo.get(msg.ludoId);
    if (!board) {
      send({ type: 'error', message: 'Board not found', code: 'not_found' });
      return;
    }

    switch (msg.type) {
      case 'ludo_sit': {
        const result = board.sit(userId, name, msg.seat);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Sit failed' });
        break;
      }
      case 'ludo_stand': {
        const result = board.stand(userId, msg.seat);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Stand failed' });
        break;
      }
      case 'ludo_set_ready': {
        const result = board.setReady(userId, msg.ready);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Ready failed' });
        break;
      }
      case 'ludo_roll': {
        const result = board.roll(userId, msg.seq);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Roll failed' });
        break;
      }
      case 'ludo_move': {
        const result = board.move(userId, msg.tokenIndex, msg.seq);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Move failed' });
        break;
      }
      case 'ludo_add_bot': {
        const seating = this.site.getBotSeatingConfig();
        const result = board.addBot(
          userId,
          msg.seat ?? undefined,
          1,
          seating.names,
          seating,
        );
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Add bot failed' });
        break;
      }
      case 'ludo_remove_bot': {
        const result = board.removeBot(msg.seat);
        if (!result.ok) send({ type: 'error', message: result.error ?? 'Remove bot failed' });
        break;
      }
      case 'ludo_chat':
        board.chat(userId, name, msg.text);
        break;
      default:
        break;
    }
  }
}
