import type { VirtualUser } from '../core/users.js';
import { chunk, rampDelay, sleep, untilAborted } from '../core/util.js';
import { openAuthedSocket } from './socketBasic.js';
import { createTable, joinTable, leaveAndClose } from './tables.js';
import type { Scenario, ScenarioContext } from './types.js';

const CHAT_PREFIX = 'lt:';

/** Chat text carrying a high-resolution send timestamp (same process → same clock). */
export function chatPayload(now = performance.timeOrigin + performance.now()): string {
  return `${CHAT_PREFIX}${now.toFixed(1)}`;
}

/** Send timestamp from a load-test chat text, or null for any other chat line. */
export function parseChatPayload(text: unknown): number | null {
  if (typeof text !== 'string' || !text.startsWith(CHAT_PREFIX)) return null;
  const ts = Number(text.slice(CHAT_PREFIX.length));
  return Number.isFinite(ts) ? ts : null;
}

type Group = { joined: number };

async function roomMember(
  ctx: ScenarioContext,
  user: VirtualUser,
  tableId: string,
  spectate: boolean,
  group: Group,
): Promise<void> {
  const sock = await openAuthedSocket(ctx, user);
  if (!sock) return;
  sock.onMessage((m) => {
    if (m.type !== 'chat' || m.tableId !== tableId) return;
    const sentAt = parseChatPayload(m.text);
    if (sentAt === null) return;
    ctx.metrics.observe('ws.chat_fanout', performance.timeOrigin + performance.now() - sentAt);
    ctx.metrics.count('chat.received');
  });
  let dropped = false;
  const drop = new Promise<void>((resolve) => {
    sock.onDrop = () => {
      dropped = true;
      resolve();
    };
  });
  if (!(await joinTable(ctx, sock, tableId, spectate))) {
    await leaveAndClose(sock, tableId);
    return;
  }
  group.joined += 1;
  ctx.metrics.count(spectate ? 'rooms.spectators' : 'rooms.players');
  sock.startPing(ctx.config.options.socket.pingIntervalMs);

  const interval = ctx.config.options.rooms.chatIntervalMs;
  const chatLoop = (async () => {
    // Desynchronize members so a table's chats don't arrive in bursts.
    if (!(await sleep(Math.random() * interval, ctx.signal))) return;
    while (!ctx.signal.aborted && !dropped) {
      if (sock.send({ type: 'chat', tableId, text: chatPayload() })) {
        ctx.metrics.count('chat.sent');
        // Every joined connection (sender included) should receive the broadcast.
        ctx.metrics.count('chat.expected', group.joined);
      }
      // Only stretch the interval: the server allows 10 chats per 5s per user.
      if (!(await sleep(interval * (1 + Math.random() * 0.3), ctx.signal))) return;
    }
  })();

  await Promise.race([untilAborted(ctx.signal), drop]);
  await chatLoop;
  group.joined = Math.max(0, group.joined - 1);
  if (!dropped) await leaveAndClose(sock, tableId);
}

export const socketRoomsScenario: Scenario = {
  id: 'socket-rooms',
  label: 'Table rooms + chat fan-out',
  usersNeeded: (config) => config.vus,
  async run(ctx) {
    const { seatsPerTable, spectatorsPerTable } = ctx.config.options.rooms;
    const groups = chunk(ctx.users, seatsPerTable + spectatorsPerTable);
    ctx.log(`${groups.length} tables × (${seatsPerTable} seats + ${spectatorsPerTable} spectators)`);
    await Promise.all(
      groups.map(async (members, k) => {
        if (!(await sleep(rampDelay(k, groups.length, ctx.rampUpMs), ctx.signal))) return;
        const table = await createTable(ctx, members[0]!, {
          name: `LT ${ctx.runId.slice(0, 6)} #${k + 1}`,
          maxSeats: seatsPerTable,
          smallBlind: 5,
          bigBlind: 10,
          buyIn: 1000,
          turnTimeMs: 20_000,
        });
        if (!table) return;
        ctx.metrics.count('rooms.tables');
        const group: Group = { joined: 0 };
        await Promise.all(
          members.map(async (user, i) => {
            if (!(await sleep(i * 50, ctx.signal))) return;
            await roomMember(ctx, user, table.tableId, i >= seatsPerTable, group);
          }),
        );
      }),
    );
  },
};
