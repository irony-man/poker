import type { VirtualUser } from '../core/users.js';
import { errorMessage, rampDelay, sleep, untilAborted } from '../core/util.js';
import { LtSocket } from '../core/wsClient.js';
import type { Scenario, ScenarioContext } from './types.js';

const RECONNECT_DELAY_MS = 1000;

/** Connect + auth; resolves with the socket or null on failure (already recorded). */
export async function openAuthedSocket(ctx: ScenarioContext, user: VirtualUser): Promise<LtSocket | null> {
  const sock = new LtSocket(ctx.target.wsUrl, ctx.metrics, ctx.loadtestToken);
  try {
    await sock.connect();
  } catch {
    return null;
  }
  try {
    await sock.auth(user.ticket);
    return sock;
  } catch (err) {
    ctx.metrics.fail(`ws auth: ${errorMessage(err)}`);
    await sock.close();
    return null;
  }
}

/** One VU: connect, check lobby broadcast, auth, ping until stopped; reconnect on drop. */
async function basicVu(ctx: ScenarioContext, user: VirtualUser): Promise<void> {
  while (!ctx.signal.aborted) {
    const connectedAt = performance.now();
    const sock = new LtSocket(ctx.target.wsUrl, ctx.metrics, ctx.loadtestToken);
    let opened = false;
    // Server pushes the public lobby right after the upgrade, so listen before connecting.
    const lobby = sock
      .waitFor((m) => m.type === 'public_tables_sync', 10_000, 'public_tables_sync')
      .then(() => ctx.metrics.observe('ws.lobby_sync', performance.now() - connectedAt))
      .catch(() => {
        if (opened && !ctx.signal.aborted && !sock.hasSeen('public_tables_sync')) {
          ctx.metrics.fail('ws: no public_tables_sync');
        }
      });
    try {
      await sock.connect();
      opened = true;
    } catch {
      await lobby;
      if (!(await sleep(RECONNECT_DELAY_MS, ctx.signal))) return;
      continue;
    }
    let dropped = false;
    const dropSignal = new Promise<void>((resolve) => {
      sock.onDrop = () => {
        dropped = true;
        resolve();
      };
    });
    try {
      await sock.auth(user.ticket);
    } catch (err) {
      ctx.metrics.fail(`ws auth: ${errorMessage(err)}`);
      await sock.close();
      if (!(await sleep(RECONNECT_DELAY_MS * 5, ctx.signal))) return;
      continue;
    }
    sock.startPing(ctx.config.options.socket.pingIntervalMs);
    await Promise.race([untilAborted(ctx.signal), dropSignal]);
    await lobby;
    if (!dropped) {
      await sock.close();
      return;
    }
    ctx.metrics.count('ws.reconnects');
    if (!(await sleep(RECONNECT_DELAY_MS, ctx.signal))) return;
  }
}

export const socketBasicScenario: Scenario = {
  id: 'socket-basic',
  label: 'WebSocket connect + auth + ping',
  usersNeeded: (config) => config.vus,
  async run(ctx) {
    const n = ctx.users.length;
    await Promise.all(
      ctx.users.map(async (user, i) => {
        if (!(await sleep(rampDelay(i, n, ctx.rampUpMs), ctx.signal))) return;
        await basicVu(ctx, user);
      }),
    );
  },
};
