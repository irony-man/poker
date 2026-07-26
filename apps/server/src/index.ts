import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessageSchema, CreateTableBodySchema, RegisterBodySchema } from '@poker/protocol';
import { AuthStore } from './auth.js';
import { createHistoryStore, writeSchemaDoc } from './history.js';
import { createKv } from './kv.js';
import { RoomManager } from './room.js';
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
  const auth = new AuthStore();
  const kv = await createKv();
  const history = await createHistoryStore();
  await writeSchemaDoc(process.env.DATA_DIR ?? path.join(process.cwd(), 'data'));
  const rooms = new RoomManager(kv, history);

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

  app.post('/api/register', (req, res) => {
    const parsed = RegisterBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = auth.register(parsed.data.name);
    const ticket = auth.issueTicket(user.id);
    res.json({ userId: user.id, name: user.name, ticket });
  });

  app.post('/api/ticket', (req, res) => {
    const userId = String(req.body?.userId ?? '');
    const user = auth.getUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Unknown user' });
      return;
    }
    res.json({ ticket: auth.issueTicket(user.id), userId: user.id, name: user.name });
  });

  app.post('/api/tables', (req, res) => {
    const body = CreateTableBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const userId = String(req.body?.userId ?? '');
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
    const meta = rooms.create({
      name: d.name,
      hostUserId: user.id,
      isPrivate: d.isPrivate,
      config: {
        maxSeats: d.maxSeats,
        smallBlind: d.smallBlind,
        bigBlind: d.bigBlind,
        minBuyIn: d.minBuyIn,
        maxBuyIn: d.maxBuyIn,
        turnTimeMs: d.turnTimeMs,
      },
    });
    res.json({
      tableId: meta.id,
      inviteCode: meta.inviteCode,
      name: meta.name,
      config: meta.config,
    });
  });

  app.get('/api/tables', (_req, res) => {
    res.json({ tables: rooms.listPublic() });
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

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let userId: string | null = null;
    let name: string | null = null;
    let tableId: string | null = null;

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
        send({ type: 'auth_ok', userId, name });
        return;
      }

      if (!userId || !name) {
        send({ type: 'error', message: 'Authenticate first', code: 'auth' });
        return;
      }

      if (msg.type === 'join_table') {
        const room = rooms.get(msg.tableId);
        if (!room) {
          send({ type: 'error', message: 'Table not found', code: 'not_found' });
          return;
        }
        if (tableId) {
          rooms.get(tableId)?.detach(userId);
        }
        tableId = msg.tableId;
        room.attach({ userId, name, send });
        return;
      }

      if (msg.type === 'leave_table') {
        rooms.get(msg.tableId)?.detach(userId);
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
          const result = r.addBot(userId, msg.seat, msg.buyIn);
          if (!result.ok) send({ type: 'error', message: result.error ?? 'Add bot failed' });
          break;
        }
        case 'remove_bot': {
          const result = r.removeBot(msg.seat);
          if (!result.ok) send({ type: 'error', message: result.error ?? 'Remove bot failed' });
          break;
        }
      }
    });

    ws.on('close', () => {
      if (userId && tableId) {
        rooms.get(tableId)?.detach(userId);
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
