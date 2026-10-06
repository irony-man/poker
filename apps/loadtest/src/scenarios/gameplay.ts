import type { RunConfig } from '../core/types.js';
import type { VirtualUser } from '../core/users.js';
import { chunk, jitter, rampDelay, sleep, untilAborted } from '../core/util.js';
import type { ServerMessage } from '../core/wsClient.js';
import { openAuthedSocket } from './socketBasic.js';
import { createTable, joinTable, leaveAndClose, tableIdOf } from './tables.js';
import type { Scenario, ScenarioContext } from './types.js';

type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

type TableView = {
  tableId: string;
  handId: string;
  street: string;
  toAct: number | null;
  actionSeq: number;
  players: { seat: number; userId: string | null; stack: number; status: string; ready?: boolean }[];
};

type PrivateView = {
  seat: number;
  legal: { types: ActionType[]; callAmount: number; minRaiseTo: number; maxRaiseTo: number };
} | null;

export type Decision = { action: ActionType; amount?: number };

/** Passive by default (check > call > fold); occasionally min-bet/raise to vary pot sizes. */
export function chooseAction(
  legal: NonNullable<PrivateView>['legal'],
  raisePct: number,
  rand: () => number = Math.random,
): Decision | null {
  const types = legal.types;
  if (types.length === 0) return null;
  const aggressive = types.find((t) => t === 'bet' || t === 'raise');
  if (aggressive && legal.minRaiseTo > 0 && rand() * 100 < raisePct) {
    return { action: aggressive, amount: legal.minRaiseTo };
  }
  if (types.includes('check')) return { action: 'check' };
  if (types.includes('call')) return { action: 'call' };
  if (types.includes('allin')) return { action: 'allin' };
  return { action: 'fold' };
}

const BETWEEN_HANDS = new Set(['waiting', 'payout']);

function seatsFor(config: RunConfig): number {
  return Math.min(config.options.gameplay.seatsPerTable, Math.max(2, config.vus));
}

function gameplayUsersNeeded(config: RunConfig): number {
  const seats = seatsFor(config);
  return Math.max(1, Math.floor(config.vus / seats)) * seats;
}

async function player(
  ctx: ScenarioContext,
  user: VirtualUser,
  tableId: string,
  countHands: boolean,
): Promise<void> {
  const opts = ctx.config.options.gameplay;
  const sock = await openAuthedSocket(ctx, user);
  if (!sock) return;

  let readyKey = '';
  let topUpKey = '';
  let actedKey = '';
  let lastPayoutHand = '';
  let pending: { handId: string; seq: number; at: number } | null = null;
  let actTimer: NodeJS.Timeout | null = null;

  const onState = (m: ServerMessage) => {
    if (m.type !== 'state_sync' || tableIdOf(m) !== tableId) return;
    const table = m.table as TableView;
    const priv = (m.private ?? null) as PrivateView;

    if (pending && (table.handId !== pending.handId || table.actionSeq !== pending.seq)) {
      ctx.metrics.observe('ws.action_to_state', performance.now() - pending.at);
      pending = null;
    }

    const mySeat = priv?.seat ?? table.players.find((p) => p.userId === user.userId)?.seat ?? null;
    if (mySeat === null) return;
    const me = table.players[mySeat];

    if (BETWEEN_HANDS.has(table.street)) {
      if (countHands && table.street === 'payout' && table.handId && table.handId !== lastPayoutHand) {
        lastPayoutHand = table.handId;
        ctx.metrics.count('poker.hands');
      }
      const key = `${table.handId}:${table.street}`;
      if (me && me.stack <= 0 && topUpKey !== key) {
        topUpKey = key;
        sock.send({ type: 'top_up', tableId, seat: mySeat, amount: opts.buyIn });
        ctx.metrics.count('poker.top_ups');
      } else if (me && me.stack > 0 && me.status !== 'sittingOut' && !me.ready && readyKey !== key) {
        readyKey = key;
        sock.send({ type: 'set_ready', tableId, ready: true });
      }
      return;
    }

    if (table.toAct !== mySeat || !priv || priv.legal.types.length === 0) return;
    const key = `${table.handId}:${table.actionSeq}`;
    if (actedKey === key) return;
    actedKey = key;
    const decision = chooseAction(priv.legal, opts.raisePct);
    if (!decision) return;
    if (actTimer) clearTimeout(actTimer);
    actTimer = setTimeout(() => {
      actTimer = null;
      if (ctx.signal.aborted) return;
      const sent = sock.send({
        type: 'action',
        tableId,
        handId: table.handId,
        seq: table.actionSeq,
        action: decision.action,
        ...(decision.amount ? { amount: decision.amount } : {}),
      });
      if (sent) {
        pending = { handId: table.handId, seq: table.actionSeq, at: performance.now() };
        ctx.metrics.count('poker.actions');
        ctx.metrics.count(`poker.action.${decision.action}`);
      }
    }, jitter(opts.turnDelayMs, 30));
  };
  sock.onMessage(onState);

  let dropped = false;
  const drop = new Promise<void>((resolve) => {
    sock.onDrop = () => {
      dropped = true;
      resolve();
    };
  });
  if (!(await joinTable(ctx, sock, tableId, false))) {
    await leaveAndClose(sock, tableId);
    return;
  }
  ctx.metrics.count('poker.players');
  sock.startPing(ctx.config.options.socket.pingIntervalMs);

  await Promise.race([untilAborted(ctx.signal), drop]);
  if (actTimer) clearTimeout(actTimer);
  if (!dropped) await leaveAndClose(sock, tableId);
}

export const gameplayScenario: Scenario = {
  id: 'gameplay',
  label: 'Poker gameplay',
  usersNeeded: gameplayUsersNeeded,
  async run(ctx) {
    const seats = seatsFor(ctx.config);
    const opts = ctx.config.options.gameplay;
    const groups = chunk(ctx.users, seats).filter((g) => g.length >= 2);
    ctx.log(`${groups.length} tables × ${seats} players (bb ${opts.bigBlind}, buy-in ${opts.buyIn})`);
    await Promise.all(
      groups.map(async (members, k) => {
        if (!(await sleep(rampDelay(k, groups.length, ctx.rampUpMs), ctx.signal))) return;
        const table = await createTable(ctx, members[0]!, {
          name: `LT play ${ctx.runId.slice(0, 6)} #${k + 1}`,
          maxSeats: seats,
          smallBlind: Math.max(1, Math.floor(opts.bigBlind / 2)),
          bigBlind: opts.bigBlind,
          buyIn: opts.buyIn,
          turnTimeMs: 30_000,
        });
        if (!table) return;
        ctx.metrics.count('poker.tables');
        await Promise.all(
          members.map(async (user, i) => {
            if (!(await sleep(i * 100, ctx.signal))) return;
            await player(ctx, user, table.tableId, i === 0);
          }),
        );
      }),
    );
  },
};
