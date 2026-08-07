import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ChallengeFriendBodySchema,
  ClientMessageSchema,
  CreateContestBodySchema,
  CreateTableBodySchema,
  FriendRequestBodySchema,
  FriendRespondBodySchema,
  RegisterBodySchema,
} from '@poker/protocol';
import { AuthStore } from './auth.js';
import { optionalClerkIdentity } from './clerkAuth.js';
import { FriendsStore } from './friends.js';
import { createHistoryStore, writeSchemaDoc } from './history.js';
import { createKv } from './kv.js';
import { ensurePublicTables } from './publicTables.js';
import { RoomManager } from './room.js';
import { TournamentManager } from './tournament.js';
import path from 'node:path';

const PORT = Number(process.env.PORT ?? 4000);
/** Comma-separated allowlist; empty entries ignored. Defaults include local Next.js. */
const EXTRA_ORIGINS = (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser / same-origin tools
  if (EXTRA_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}

async function main() {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
  const auth = new AuthStore();
  const kv = await createKv();
  const history = await createHistoryStore();
  await writeSchemaDoc(dataDir);
  const rooms = new RoomManager(kv, history);
  const tournaments = new TournamentManager(rooms);
  const friends = new FriendsStore(dataDir);
  ensurePublicTables(rooms);

  async function requireUserId(req: express.Request, res: express.Response): Promise<string | null> {
    const identity = await optionalClerkIdentity(req);
    if (identity) return identity.userId;
    const userId = String(req.body?.userId ?? req.query?.userId ?? '');
    if (!userId || !auth.getUser(userId)) {
      res.status(401).json({ error: 'Register first' });
      return null;
    }
    return userId;
  }

  const app = express();
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) callback(null, true);
        else callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/register', async (req, res) => {
    const parsed = RegisterBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const identity = await optionalClerkIdentity(req);
    const userId = identity?.userId ?? parsed.data.userId;

    const user = auth.register(parsed.data.name, parsed.data.avatarId, userId);
    const ticket = auth.issueTicket(user.id);
    res.json({
      userId: user.id,
      name: user.name,
      ticket,
      avatarId: user.avatarId,
    });
  });

  app.post('/api/ticket', async (req, res) => {
    const identity = await optionalClerkIdentity(req);
    const userId = identity?.userId ?? String(req.body?.userId ?? '');
    const user = auth.getUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Unknown user' });
      return;
    }
    res.json({
      ticket: auth.issueTicket(user.id),
      userId: user.id,
      name: user.name,
      avatarId: user.avatarId,
    });
  });

  app.post('/api/tables', async (req, res) => {
    const body = CreateTableBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const identity = await optionalClerkIdentity(req);
    const userId = identity?.userId ?? String(req.body?.userId ?? '');

    const user = auth.getUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Register first' });
      return;
    }
    const d = body.data;
    if (d.bigBlind < d.smallBlind) {
      res.status(400).json({ error: 'bigBlind must be >= smallBlind' });
      return;
    }
    let meta;
    try {
      meta = rooms.create({
        name: d.name,
        hostUserId: user.id,
        isPrivate: d.isPrivate,
        inviteCode: d.inviteCode,
        config: {
          maxSeats: d.maxSeats,
          smallBlind: d.smallBlind,
          bigBlind: d.bigBlind,
          buyIn: d.buyIn,
          turnTimeMs: d.turnTimeMs,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create table';
      const status = message.includes('already in use') ? 409 : 400;
      res.status(status).json({ error: message });
      return;
    }
    const room = rooms.get(meta.id)!;
    const maxBots = Math.max(0, d.maxSeats - 1);
    const bots = Math.min(d.botCount, maxBots);
    if (bots > 0) {
      room.addBot(user.id, undefined, d.buyIn, bots);
    }
    res.json({
      tableId: meta.id,
      inviteCode: meta.inviteCode,
      name: meta.name,
      config: meta.config,
      botsAdded: bots,
    });
  });

  app.get('/api/tables', (_req, res) => {
    res.json({ tables: rooms.listPublicLobby() });
  });

  app.get('/api/tables/invite/:code', (req, res) => {
    const room = rooms.getByInvite(req.params.code!);
    if (!room) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }
    res.json({
      tableId: room.meta.id,
      inviteCode: room.meta.inviteCode,
      name: room.meta.name,
      config: room.meta.config,
    });
  });

  app.get('/api/tables/:id/history', async (req, res) => {
    const hands = await history.listHands(req.params.id!, 50);
    res.json({ hands });
  });

  app.get('/api/friends', async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    try {
      const [friendList, incoming, pendingChallenges] = await Promise.all([
        friends.listFriends(auth, userId),
        friends.listIncomingRequests(auth, userId),
        friends.listPendingChallenges(auth, userId),
      ]);
      res.json({ friends: friendList, incoming, pendingChallenges });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.get('/api/friends/search', async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const q = String(req.query.q ?? '');
    const users = friends.searchUsers(auth, q, userId).map((u) => ({
      userId: u.id,
      name: u.name,
      avatarId: u.avatarId,
    }));
    res.json({ users });
  });

  app.post('/api/friends/requests', async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const parsed = FriendRequestBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!auth.getUser(parsed.data.targetUserId)) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    try {
      const request = await friends.sendRequest(userId, parsed.data.targetUserId);
      res.json({ request });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.post('/api/friends/requests/:id/respond', async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const parsed = FriendRespondBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const result = await friends.respondRequest(userId, req.params.id!, parsed.data.accept);
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/friends/challenge', async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const parsed = ChallengeFriendBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const challenger = auth.getUser(userId);
    const opponent = auth.getUser(parsed.data.friendUserId);
    if (!challenger || !opponent) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    try {
      const meta = rooms.create({
        name: `${challenger.name} vs ${opponent.name}`,
        hostUserId: challenger.id,
        isPrivate: true,
        config: {
          maxSeats: 2,
          smallBlind: 5,
          bigBlind: 10,
          buyIn: 1000,
          turnTimeMs: 20000,
        },
      });
      const challenge = await friends.createChallenge(
        userId,
        parsed.data.friendUserId,
        meta.id,
        meta.inviteCode,
      );
      res.json({
        tableId: meta.id,
        inviteCode: meta.inviteCode,
        challengeId: challenge.id,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Challenge failed' });
    }
  });

  app.post('/api/friends/challenges/:id/join', async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    await friends.markChallengeJoined(req.params.id!, userId);
    res.json({ ok: true });
  });

  app.post('/api/contests', async (req, res) => {
    const body = CreateContestBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const identity = await optionalClerkIdentity(req);
    const userId = identity?.userId ?? String(req.body?.userId ?? '');
    const user = auth.getUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Register first' });
      return;
    }
    try {
      const d = body.data;
      const contest = tournaments.create({
        name: d.name,
        mode: d.mode,
        hostUserId: user.id,
        hostName: user.name,
        fieldSize: d.fieldSize,
        startingStack: d.startingStack,
        smallBlind: d.smallBlind,
        bigBlind: d.bigBlind,
        turnTimeMs: d.turnTimeMs,
        botCount: d.botCount,
        isPrivate: d.isPrivate,
        inviteCode: d.inviteCode,
        autoStart: d.autoStart,
      });
      res.json({ contest });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create contest';
      const status = message.includes('already in use') ? 409 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/contests', (_req, res) => {
    res.json({ contests: tournaments.listPublic() });
  });

  app.get('/api/contests/invite/:code', (req, res) => {
    const contest = tournaments.getByInvite(req.params.code!);
    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }
    res.json({ contest });
  });

  app.get('/api/contests/:id', (req, res) => {
    const contest = tournaments.get(req.params.id!);
    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }
    res.json({ contest });
  });

  app.post('/api/contests/:id/register', async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const user = auth.getUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Register first' });
      return;
    }
    const result = tournaments.register(req.params.id!, user.id, user.name);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ contest: result.contest });
  });

  app.post('/api/contests/:id/unregister', async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const result = tournaments.unregister(req.params.id!, userId);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ contest: result.contest });
  });

  app.post('/api/contests/:id/start', async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    const result = tournaments.start(req.params.id!, userId);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ contest: result.contest });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let userId: string | null = null;
    let name: string | null = null;
    let tableId: string | null = null;
    let contestId: string | null = null;

    const send = (msg: unknown) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.on('message', (raw) => {
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
        const user = auth.consumeTicket(msg.ticket);
        if (!user) {
          send({ type: 'error', message: 'Invalid ticket', code: 'auth' });
          return;
        }
        userId = user.id;
        name = user.name;
        send({ type: 'auth_ok', userId, name, avatarId: user.avatarId });
        return;
      }

      if (!userId || !name) {
        send({ type: 'error', message: 'Authenticate first', code: 'auth' });
        return;
      }

      if (msg.type === 'join_contest') {
        if (contestId && contestId !== msg.contestId) {
          tournaments.detachWatcher(contestId, userId);
        }
        const ok = tournaments.attachWatcher(msg.contestId, userId, send);
        if (!ok) {
          send({ type: 'error', message: 'Contest not found', code: 'not_found' });
          return;
        }
        contestId = msg.contestId;
        return;
      }

      if (msg.type === 'leave_contest') {
        tournaments.detachWatcher(msg.contestId, userId);
        if (contestId === msg.contestId) contestId = null;
        return;
      }

      if (msg.type === 'join_table') {
        const room = rooms.get(msg.tableId);
        if (!room) {
          send({
            type: 'error',
            message: 'Table not found — server may have restarted. Create a new table from the lobby.',
            code: 'not_found',
          });
          return;
        }
        if (tableId) {
          rooms.get(tableId)?.detach(userId);
        }
        tableId = msg.tableId;
        const avatarId = auth.getUser(userId)?.avatarId ?? 0;
        room.attach({ userId, name, avatarId, send });
        // Join means play: seat automatically unless the client asked to spectate.
        if (!msg.spectate) {
          const seated = room.autoSit(userId, name);
          if (!seated.ok && seated.error && seated.error !== 'Table full') {
            // Tournament seats are pre-assigned — already seated is fine; other errors surface.
            if (seated.error !== 'Tournament seats are assigned') {
              send({ type: 'error', message: seated.error, code: 'sit_failed' });
            }
          }
        }
        return;
      }

      if (msg.type === 'leave_table') {
        rooms.get(msg.tableId)?.leave(userId);
        if (tableId === msg.tableId) tableId = null;
        return;
      }

      if (!('tableId' in msg)) return;
      const r = rooms.get(msg.tableId);
      if (!r) {
        send({ type: 'error', message: 'Table not found', code: 'not_found' });
        return;
      }

      switch (msg.type) {
        case 'sit': {
          const result = r.sit(userId, name, msg.seat, msg.buyIn);
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
          const result = r.doTopUp(userId, msg.seat, msg.amount);
          if (!result.ok) send({ type: 'error', message: result.error ?? 'Top-up failed' });
          break;
        }
        case 'start_hand': {
          const result = r.startHand(userId);
          if (!result.ok) send({ type: 'error', message: result.error ?? 'Start failed' });
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
      }
    });

    ws.on('close', () => {
      if (userId && tableId) {
        const room = rooms.get(tableId);
        room?.detach(userId);
        room?.scheduleDisconnect(userId);
      }
      if (userId && contestId) {
        tournaments.detachWatcher(contestId, userId);
      } else if (userId) {
        tournaments.detachWatcherAll(userId);
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`[poker-server] http://localhost:${PORT}`);
    console.log(`[poker-server] ws://localhost:${PORT}/ws`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
