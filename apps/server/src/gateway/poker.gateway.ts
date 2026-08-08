import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ClientMessageSchema } from '@poker/protocol';
import type { RawData, WebSocket } from 'ws';
import { AuthService } from '../auth/auth.service.js';
import { ContestsService } from '../contests/contests.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { WalletService } from '../wallet/wallet.service.js';

type SocketState = {
  userId: string | null;
  name: string | null;
  tableId: string | null;
  contestId: string | null;
  send: (msg: unknown) => void;
};

@WebSocketGateway({ path: '/ws' })
export class PokerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PokerGateway.name);
  private readonly states = new WeakMap<WebSocket, SocketState>();

  constructor(
    private readonly auth: AuthService,
    private readonly wallet: WalletService,
    private readonly rooms: RoomsService,
    private readonly contests: ContestsService,
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
      send,
    });
    client.on('message', (raw: RawData) => {
      void this.handleMessage(client, raw);
    });
  }

  handleDisconnect(@ConnectedSocket() client: WebSocket): void {
    const st = this.states.get(client);
    if (!st) return;
    const { userId, tableId, contestId, send } = st;
    if (userId && tableId) {
      const room = this.rooms.get(tableId);
      if (room?.detachIfActive(userId, send)) {
        room.scheduleDisconnect(userId);
      }
    }
    if (userId && contestId) {
      this.contests.detachWatcher(contestId, userId);
    } else if (userId) {
      this.contests.detachWatcherAll(userId);
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
      return;
    }

    if (msg.type === 'auth') {
      const user = this.auth.consumeTicket(msg.ticket);
      if (!user) {
        send({ type: 'error', message: 'Invalid or expired ticket', code: 'bad_auth' });
        return;
      }
      st.userId = user.id;
      st.name = user.name;
      void this.wallet.ensureStartingBalance(user.id);
      send({
        type: 'auth_ok',
        userId: user.id,
        name: user.name,
        avatarId: user.avatarId,
        chipBalance: this.wallet.getBalance(user.id),
      });
      return;
    }

    if (!st.userId || !st.name) {
      send({ type: 'error', message: 'Authenticate first', code: 'auth' });
      return;
    }

    const userId = st.userId;
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

    if (msg.type === 'join_table') {
      const room = this.rooms.get(msg.tableId);
      if (!room) {
        send({
          type: 'error',
          message: 'Table not found — server may have restarted. Create a new table from the lobby.',
          code: 'not_found',
        });
        return;
      }
      if (st.tableId) {
        this.rooms.get(st.tableId)?.detach(userId);
      }
      st.tableId = msg.tableId;
      const avatarId = this.auth.getUser(userId)?.avatarId ?? 0;
      room.attach({ userId, name, avatarId, send });
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
        const result = r.addBot(userId, msg.seat, msg.buyIn, msg.count ?? 1);
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
}
