import type { VirtualUser } from '../core/users.js';
import type { LtSocket, ServerMessage } from '../core/wsClient.js';
import type { ScenarioContext } from './types.js';

export type CreatedTable = { tableId: string; inviteCode: string };

export type TableSpec = {
  name: string;
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  turnTimeMs: number;
};

/** Private bot-free table hosted by `host` (same payload shape as the smoke test). */
export async function createTable(
  ctx: ScenarioContext,
  host: VirtualUser,
  spec: TableSpec,
): Promise<CreatedTable | null> {
  const res = await ctx.http.request<{ tableId?: string; inviteCode?: string }>(
    'POST /api/tables',
    'POST',
    '/api/tables',
    {
      token: host.sessionToken,
      body: { ...spec, botCount: 0, isPrivate: true },
    },
  );
  if (!res.ok || !res.data?.tableId) {
    ctx.log(`create table failed: ${res.status} ${res.error ?? ''}`);
    return null;
  }
  return { tableId: res.data.tableId, inviteCode: res.data.inviteCode ?? '' };
}

export function tableIdOf(msg: ServerMessage): string | null {
  const table = msg.table as { tableId?: unknown } | undefined;
  return typeof table?.tableId === 'string' ? table.tableId : null;
}

/** `join_table` and wait for the first `state_sync` of that table. Records `ws.join_table`. */
export async function joinTable(
  ctx: ScenarioContext,
  sock: LtSocket,
  tableId: string,
  spectate: boolean,
): Promise<boolean> {
  const started = performance.now();
  const synced = sock.waitFor(
    (m) => m.type === 'state_sync' && tableIdOf(m) === tableId,
    15_000,
    'state_sync',
  );
  sock.send({ type: 'join_table', tableId, spectate });
  try {
    await synced;
    ctx.metrics.observe('ws.join_table', performance.now() - started);
    return true;
  } catch {
    if (!ctx.signal.aborted) ctx.metrics.fail('ws join_table: no state_sync');
    return false;
  }
}

/** Fold/stand + detach, then close the socket. */
export async function leaveAndClose(sock: LtSocket, tableId: string | null): Promise<void> {
  if (tableId) sock.send({ type: 'leave_table', tableId });
  await sock.close();
}
