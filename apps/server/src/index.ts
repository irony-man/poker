import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ChallengeFriendBodySchema,
  ClientMessageSchema,
  CreateContestBodySchema,
  CreateFriendGroupBodySchema,
  CreateTableBodySchema,
  FriendRequestBodySchema,
  FriendRespondBodySchema,
  InviteFriendGroupBodySchema,
  InviteFriendsBodySchema,
  LoginBodySchema,
  SignupBodySchema,
  UpdateFriendGroupBodySchema,
} from '@poker/protocol';
import { AuthError, AuthStore, bearerToken } from './auth.js';
import { initDatabase } from './db.js';
import { FriendsStore } from './friends.js';
import { createHistoryStore, writeSchemaDoc } from './history.js';
import { createKv } from './kv.js';
import { ensurePublicTables } from './publicTables.js';
import { RoomManager } from './room.js';
import { createTableChipStore } from './tableChips.js';
import { TournamentManager } from './tournament.js';

// Load monorepo root .env then apps/server/.env (later wins).
const serverDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(serverDir, '../../../.env') });
loadEnv({ path: path.resolve(serverDir, '../.env') });

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

/** Simple per-IP rate limit for signup/login. */
function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (ip: string): boolean => {
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}

async function main() {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
  const pool = await initDatabase();

  const auth = new AuthStore(dataDir);
  auth.setPool(pool);
  await auth.init();

  const kv = await createKv();
  const history = await createHistoryStore(pool);
  await writeSchemaDoc(dataDir);
  const chips = await createTableChipStore(pool, dataDir);
  const rooms = new RoomManager(kv, history, chips);
  const tournaments = new TournamentManager(rooms);
  const friends = new FriendsStore(dataDir, pool);
  ensurePublicTables(rooms);

  const loginLimit = createRateLimiter(20, 60_000);
  const signupLimit = createRateLimiter(10, 60_000);

  function clientIp(req: express.Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  function requireUserId(req: express.Request, res: express.Response): string | null {
    const token = bearerToken(req.header('authorization') ?? req.header('Authorization') ?? undefined);
    if (!token) {
      res.status(401).json({ error: 'Sign in required' });
      return null;
    }
    const user = auth.resolveSession(token);
    if (!user) {
      res.status(401).json({ error: 'Session expired or invalid' });
      return null;
    }
    return user.id;
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

  app.post('/api/signup', async (req, res) => {
    if (!signupLimit(clientIp(req))) {
      res.status(429).json({ error: 'Too many signup attempts' });
      return;
    }
    const parsed = SignupBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const session = await auth.signup(
        parsed.data.username,
        parsed.data.password,
        parsed.data.avatarId,
      );
      res.status(201).json(session);
    } catch (err) {
      if (err instanceof AuthError && err.code === 'username_taken') {
        res.status(409).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'Signup failed' });
    }
  });

  app.post('/api/login', async (req, res) => {
    if (!loginLimit(clientIp(req))) {
      res.status(429).json({ error: 'Too many login attempts' });
      return;
    }
    const parsed = LoginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const session = await auth.login(parsed.data.username, parsed.data.password);
      res.json(session);
    } catch (err) {
      if (err instanceof AuthError && err.code === 'invalid_credentials') {
        res.status(401).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: err instanceof Error ? err.message : 'Login failed' });
    }
  });

  app.post('/api/logout', async (req, res) => {
    const token = bearerToken(req.header('authorization') ?? req.header('Authorization') ?? undefined);
    if (token) await auth.revokeSession(token);
    res.json({ ok: true });
  });

  app.post('/api/register', (_req, res) => {
    res.status(410).json({
      error: 'Anonymous register removed. Use /api/signup or /api/login.',
    });
  });

  app.post('/api/ticket', async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const user = auth.getUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Unknown user' });
      return;
    }
    const ticket = await auth.issueTicketAndPersist(user.id);
    res.json({
      ticket,
      userId: user.id,
      name: user.name,
      username: user.username,
      avatarId: user.avatarId,
    });
  });

  app.post('/api/tables', async (req, res) => {
    const body = CreateTableBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const userId = requireUserId(req, res);
    if (!userId) return;

    const user = auth.getUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Sign in required' });
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

    let inviteCount = 0;
    if (d.inviteFriendIds.length > 0) {
      const invites = await friends.createFriendInvites(user.id, d.inviteFriendIds, {
        kind: 'table',
        tableId: meta.id,
        inviteCode: meta.inviteCode,
      });
      inviteCount = invites.length;
    }

    res.json({
      tableId: meta.id,
      inviteCode: meta.inviteCode,
      name: meta.name,
      config: meta.config,
      botsAdded: bots,
      inviteCount,
    });
  });

  app.post('/api/tables/:id/invite-friends', async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const parsed = InviteFriendsBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const room = rooms.get(req.params.id!);
    if (!room) {
      res.status(404).json({ error: 'Table not found' });
      return;
    }
    if (room.meta.hostUserId !== userId) {
      res.status(403).json({ error: 'Only the host can invite friends' });
      return;
    }
    if (parsed.data.friendUserIds.length === 0) {
      res.json({ inviteCount: 0, challengeIds: [] as string[] });
      return;
    }
    const challenges = await friends.createFriendInvites(userId, parsed.data.friendUserIds, {
      kind: 'table',
      tableId: room.meta.id,
      inviteCode: room.meta.inviteCode,
    });
    res.json({
      inviteCount: challenges.length,
      challengeIds: challenges.map((c) => c.id),
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
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const [friendList, incoming, pendingChallenges, groups] = await Promise.all([
        friends.listFriends(auth, userId),
        friends.listIncomingRequests(auth, userId),
        friends.listPendingChallenges(auth, userId),
        friends.listGroups(auth, userId),
      ]);
      res.json({ friends: friendList, incoming, pendingChallenges, groups });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.post('/api/friends/groups', async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const parsed = CreateFriendGroupBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const group = await friends.createGroup(
        auth,
        userId,
        parsed.data.name,
        parsed.data.memberUserIds,
      );
      res.status(201).json({ group });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed' });
    }
  });

  app.patch('/api/friends/groups/:id', async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const parsed = UpdateFriendGroupBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const group = await friends.updateGroup(auth, userId, req.params.id!, parsed.data);
      res.json({ group });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed';
      const status = message === 'Group not found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.delete('/api/friends/groups/:id', async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      await friends.deleteGroup(userId, req.params.id!);
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed';
      const status = message === 'Group not found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/friends/groups/:id/invite', async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const parsed = InviteFriendGroupBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const host = auth.getUser(userId);
    if (!host) {
      res.status(401).json({ error: 'Sign in required' });
      return;
    }
    try {
      const group = await friends.requireGroup(req.params.id!);
      const isInGroup =
        group.ownerUserId === userId || group.memberUserIds.includes(userId);
      if (!isInGroup) {
        res.status(403).json({ error: 'You are not in this group' });
        return;
      }

      const defaultInvitees = [
        group.ownerUserId,
        ...group.memberUserIds,
      ].filter((id) => id !== userId);
      const inviteeIds = parsed.data.memberUserIds?.length
        ? parsed.data.memberUserIds
        : defaultInvitees;

      const seatsNeeded = Math.min(9, Math.max(2, inviteeIds.length + 1));
      const maxSeats = parsed.data.maxSeats ?? seatsNeeded;
      const smallBlind = parsed.data.smallBlind ?? 5;
      const bigBlind = parsed.data.bigBlind ?? 10;
      const buyIn = parsed.data.buyIn ?? 1000;

      const meta = rooms.create({
        name: `${group.name}`,
        hostUserId: host.id,
        isPrivate: true,
        config: {
          maxSeats,
          smallBlind,
          bigBlind,
          buyIn,
          turnTimeMs: 20000,
        },
      });

      const challenges = await friends.createGroupGameInvites(
        userId,
        group,
        inviteeIds,
        meta.id,
        meta.inviteCode,
      );

      res.json({
        tableId: meta.id,
        inviteCode: meta.inviteCode,
        inviteCount: challenges.length,
        challengeIds: challenges.map((c) => c.id),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invite failed';
      const status = message === 'Group not found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/friends/search', (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const q = String(req.query.q ?? '');
    const users = friends.searchUsers(auth, q, userId).map((u) => ({
      userId: u.id,
      name: u.username || u.name,
      username: u.username,
      avatarId: u.avatarId,
    }));
    res.json({ users });
  });

  app.post('/api/friends/requests', async (req, res) => {
    const userId = requireUserId(req, res);
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
    const userId = requireUserId(req, res);
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
    const userId = requireUserId(req, res);
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
    const userId = requireUserId(req, res);
    if (!userId) return;
    await friends.markChallengeJoined(req.params.id!, userId);
    res.json({ ok: true });
  });

  app.post('/api/friends/challenges/:id/decline', async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const result = await friends.declineChallenge(req.params.id!, userId);
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/contests', async (req, res) => {
    const body = CreateContestBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const userId = requireUserId(req, res);
    if (!userId) return;
    const user = auth.getUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Sign in required' });
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
        handLimit: d.handLimit,
      });

      let inviteCount = 0;
      if (d.inviteFriendIds.length > 0) {
        const invites = await friends.createFriendInvites(user.id, d.inviteFriendIds, {
          kind: 'contest',
          contestId: contest.id,
          inviteCode: contest.inviteCode,
        });
        inviteCount = invites.length;
      }

      res.json({ contest, inviteCount });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create contest';
      const status = message.includes('already in use') ? 409 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/contests/:id/invite-friends', async (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const parsed = InviteFriendsBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const contest = tournaments.get(req.params.id!);
    if (!contest) {
      res.status(404).json({ error: 'Contest not found' });
      return;
    }
    if (contest.hostUserId !== userId) {
      res.status(403).json({ error: 'Only the host can invite friends' });
      return;
    }
    if (contest.status !== 'registering') {
      res.status(400).json({ error: 'Registration is closed' });
      return;
    }
    if (parsed.data.friendUserIds.length === 0) {
      res.json({ inviteCount: 0, challengeIds: [] as string[] });
      return;
    }
    const challenges = await friends.createFriendInvites(userId, parsed.data.friendUserIds, {
      kind: 'contest',
      contestId: contest.id,
      inviteCode: contest.inviteCode,
    });
    res.json({
      inviteCount: challenges.length,
      challengeIds: challenges.map((c) => c.id),
    });
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

  app.post('/api/contests/:id/register', (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const user = auth.getUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Sign in required' });
      return;
    }
    const result = tournaments.register(req.params.id!, user.id, user.name);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ contest: result.contest });
  });

  app.post('/api/contests/:id/unregister', (req, res) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    const result = tournaments.unregister(req.params.id!, userId);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ contest: result.contest });
  });

  app.post('/api/contests/:id/start', (req, res) => {
    const userId = requireUserId(req, res);
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
      void handleMessage(raw);
    });

    async function handleMessage(raw: WebSocket.RawData): Promise<void> {
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
          send({ type: 'error', message: 'Invalid or expired ticket', code: 'bad_auth' });
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
          const seated = await room.autoSit(userId, name);
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
          const result = r.doTopUp(userId, msg.seat, msg.amount);
          if (!result.ok) send({ type: 'error', message: result.error ?? 'Top-up failed' });
          break;
        }
        case 'start_hand': {
          // Cash: toggles ready consensus. Tournament: deals immediately.
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

    ws.on('close', () => {
      if (userId && tableId) {
        const room = rooms.get(tableId);
        // Only detach if this socket is still the registered one — a faster
        // reconnect would have replaced the map entry and must not be cleared.
        if (room?.detachIfActive(userId, send)) {
          room.scheduleDisconnect(userId);
        }
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
