'use client';

import { useCallback, useEffect, useRef } from 'react';
import type {
  ContestView,
  FriendGroup,
  FriendProfile,
  PendingChallenge,
  PendingRequest,
  PublicTableSummary,
} from '@/lib/api';
import { WS_URL } from '@/lib/api';
import { emitSocketMessage } from './socketMessages';
import { isSeatActionLabel } from '@/lib/seatAction';
import { clearStoredSession } from './session';
import { useSession, type PrivateView, type PublicTable } from './store';

const RECONNECT_DELAY_MS = 2_000;
const PING_MS = 20_000;

/** Shared session WebSocket: one connection for lobby, table, and contest. */
let sharedWs: WebSocket | null = null;
let sharedTicket: string | null = null;
let authSentForTicket: string | null = null;
let intentionalClose = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let emojiClearTimer: ReturnType<typeof setTimeout> | null = null;
/** How many React roots hold the session socket open. */
let holdCount = 0;

function clearTimers(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function dispatchMessage(msg: { type?: string; [key: string]: unknown }): void {
  emitSocketMessage(msg);
  const s = useSession.getState();

  switch (msg.type) {
    case 'auth_ok': {
      s.setConnection('open');
      if (typeof msg.chipBalance === 'number') {
        s.setChipBalance(msg.chipBalance);
      }
      if (typeof msg.whuffieBalance === 'number') {
        s.setWhuffieBalance(msg.whuffieBalance);
      }
      break;
    }
    case 'wallet_update': {
      if (typeof msg.chipBalance === 'number') {
        s.setChipBalance(msg.chipBalance);
      }
      if (typeof msg.whuffieBalance === 'number') {
        s.setWhuffieBalance(msg.whuffieBalance);
      }
      break;
    }
    case 'public_tables_sync': {
      s.applyPublicTables((msg.tables as PublicTableSummary[]) ?? []);
      break;
    }
    case 'public_contests_sync': {
      s.applyPublicContests((msg.contests as ContestView[]) ?? []);
      break;
    }
    case 'my_contests_sync': {
      s.applyMyContests((msg.contests as ContestView[]) ?? []);
      break;
    }
    case 'social_sync': {
      s.applySocial({
        friends: (msg.friends as FriendProfile[]) ?? [],
        incoming: (msg.incoming as PendingRequest[]) ?? [],
        pendingChallenges: (msg.pendingChallenges as PendingChallenge[]) ?? [],
        groups: (msg.groups as FriendGroup[]) ?? [],
      });
      break;
    }
    case 'state_sync': {
      const table = msg.table as PublicTable;
      if (table?.tableId && s.boundTableId && table.tableId !== s.boundTableId) return;
      s.applyStateSync(table, (msg.private as PrivateView) ?? null);
      break;
    }
    case 'chat':
      s.pushChat({
        userId: String(msg.userId ?? ''),
        name: String(msg.name ?? ''),
        text: String(msg.text ?? ''),
        at: typeof msg.at === 'number' ? msg.at : Date.now(),
      });
      break;
    case 'emoji':
      s.setEmoji({
        emoji: String(msg.emoji ?? ''),
        name: String(msg.name ?? ''),
        at: typeof msg.at === 'number' ? msg.at : Date.now(),
      });
      if (emojiClearTimer) clearTimeout(emojiClearTimer);
      emojiClearTimer = setTimeout(() => s.setEmoji(null), 1800);
      break;
    case 'seat_action': {
      const label =
        typeof msg.label === 'string' ? msg.label : String(msg.action ?? '');
      if (isSeatActionLabel(label)) {
        const actionRaw = typeof msg.action === 'string' ? msg.action : undefined;
        const action =
          actionRaw === 'fold' ||
          actionRaw === 'check' ||
          actionRaw === 'call' ||
          actionRaw === 'bet' ||
          actionRaw === 'raise' ||
          actionRaw === 'allin'
            ? actionRaw
            : undefined;
        s.setActionBurst({
          seat: typeof msg.seat === 'number' ? msg.seat : 0,
          label,
          at: typeof msg.at === 'number' ? msg.at : Date.now(),
          action,
        });
      }
      break;
    }
    case 'contest_sync': {
      if (msg.contest && typeof msg.contest === 'object') {
        s.applyContestSync(msg.contest as ContestView);
      }
      break;
    }
    case 'contest_event': {
      s.applyContestEvent({
        contestId: String(msg.contestId ?? ''),
        event: String(msg.event ?? ''),
        tableId: typeof msg.tableId === 'string' ? msg.tableId : undefined,
        message: typeof msg.message === 'string' ? msg.message : undefined,
        place: typeof msg.place === 'number' ? msg.place : undefined,
      });
      break;
    }
    case 'error': {
      const code = typeof msg.code === 'string' ? msg.code : null;
      s.setError(
        typeof msg.message === 'string' ? msg.message : 'Error',
        code,
      );
      if (code === 'account_deleted') {
        clearStoredSession();
        s.clearSession();
      }
      break;
    }
    default:
      break;
  }
}

/** Tickets that must never be sent as WebSocket auth. */
function isClientOnlyTicket(ticket: string | null | undefined): boolean {
  return !ticket || ticket === 'offline';
}

function connectShared(): void {
  if (typeof window === 'undefined') return;
  if (holdCount <= 0) return;
  if (
    sharedWs &&
    (sharedWs.readyState === WebSocket.OPEN || sharedWs.readyState === WebSocket.CONNECTING)
  ) {
    if (
      sharedWs.readyState === WebSocket.OPEN &&
      sharedTicket &&
      !isClientOnlyTicket(sharedTicket) &&
      authSentForTicket !== sharedTicket
    ) {
      authSentForTicket = sharedTicket;
      sharedWs.send(JSON.stringify({ type: 'auth', ticket: sharedTicket }));
    }
    return;
  }

  intentionalClose = false;
  useSession.getState().setConnection('connecting');
  const ws = new WebSocket(WS_URL);
  sharedWs = ws;

  ws.onopen = () => {
    if (sharedWs !== ws) return;
    if (sharedTicket && !isClientOnlyTicket(sharedTicket)) {
      authSentForTicket = sharedTicket;
      ws.send(JSON.stringify({ type: 'auth', ticket: sharedTicket }));
    } else {
      useSession.getState().setConnection('open');
      authSentForTicket = null;
    }
  };

  ws.onmessage = (ev) => {
    if (sharedWs !== ws) return;
    let msg: { type?: string; [key: string]: unknown };
    try {
      msg = JSON.parse(String(ev.data)) as { type?: string; [key: string]: unknown };
    } catch {
      return;
    }
    dispatchMessage(msg);
  };

  ws.onclose = () => {
    if (sharedWs === ws) sharedWs = null;
    authSentForTicket = null;
    useSession.getState().setConnection('closed');
    if (!intentionalClose && holdCount > 0) {
      reconnectTimer = setTimeout(connectShared, RECONNECT_DELAY_MS);
    }
  };

  ws.onerror = () => {
    if (sharedWs !== ws) return;
    useSession.getState().setError('WebSocket error');
  };

  if (pingTimer) clearInterval(pingTimer);
  pingTimer = setInterval(() => {
    if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
      sharedWs.send(JSON.stringify({ type: 'ping' }));
    }
  }, PING_MS);
}

function disconnectShared(): void {
  intentionalClose = true;
  clearTimers();
  if (emojiClearTimer) {
    clearTimeout(emojiClearTimer);
    emojiClearTimer = null;
  }
  if (sharedWs) {
    sharedWs.onclose = null;
    sharedWs.onmessage = null;
    sharedWs.onerror = null;
    sharedWs.onopen = null;
    sharedWs.close();
    sharedWs = null;
  }
  authSentForTicket = null;
  useSession.getState().setConnection('closed');
}

export function sessionSocketSend(payload: unknown): boolean {
  if (sharedWs && sharedWs.readyState === WebSocket.OPEN) {
    sharedWs.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

/**
 * Keep a single app-level WebSocket open (lobby + table + contest).
 * Mount from AppChrome; re-auths when ticket changes.
 */
export function useSessionSocket(): void {
  const ticket = useSession((s) => s.ticket);

  useEffect(() => {
    holdCount += 1;
    connectShared();
    return () => {
      holdCount = Math.max(0, holdCount - 1);
      if (holdCount === 0) {
        disconnectShared();
      }
    };
  }, []);

  useEffect(() => {
    sharedTicket = ticket;
    if (!ticket || isClientOnlyTicket(ticket)) {
      // Logged out / offline practice: reopen as guest so server drops user registration.
      if (sharedWs && authSentForTicket) {
        intentionalClose = true;
        sharedWs.close();
        sharedWs = null;
        authSentForTicket = null;
        intentionalClose = false;
        if (holdCount > 0) connectShared();
      }
      return;
    }
    if (
      sharedWs &&
      sharedWs.readyState === WebSocket.OPEN &&
      authSentForTicket !== ticket
    ) {
      authSentForTicket = ticket;
      sharedWs.send(JSON.stringify({ type: 'auth', ticket }));
    } else if (holdCount > 0) {
      connectShared();
    }
  }, [ticket]);
}

/**
 * Join a cash/public table on the shared session socket.
 * Does not own the connection lifecycle.
 */
export function usePokerSocket(tableId: string | null, opts?: { spectate?: boolean }) {
  const spectate = opts?.spectate ?? false;
  const bindTable = useSession((s) => s.bindTable);
  const setError = useSession((s) => s.setError);
  const connection = useSession((s) => s.connection);
  const lastErrorCode = useSession((s) => s.lastErrorCode);
  const spectateRef = useRef(spectate);
  const joinedRef = useRef<string | null>(null);
  spectateRef.current = spectate;

  const sendJoin = useCallback(
    (id: string, force = false) => {
      if (useSession.getState().connection !== 'open') return;
      if (!force && joinedRef.current === id) return;
      if (
        sessionSocketSend({
          type: 'join_table',
          tableId: id,
          ...(spectateRef.current ? { spectate: true } : {}),
        })
      ) {
        joinedRef.current = id;
      }
    },
    [],
  );

  useEffect(() => {
    if (!tableId) return;
    bindTable(tableId);
    joinedRef.current = null;
    sendJoin(tableId, true);
    const id = window.setInterval(() => sendJoin(tableId), 500);
    return () => {
      window.clearInterval(id);
      if (joinedRef.current === tableId) {
        sessionSocketSend({ type: 'leave_table', tableId });
        joinedRef.current = null;
      }
    };
  }, [tableId, bindTable, sendJoin]);

  // Re-join after socket reconnect (connection open again).
  useEffect(() => {
    if (connection !== 'open' || !tableId) return;
    sendJoin(tableId, true);
  }, [connection, tableId, sendJoin]);

  // Stop retrying join on fatal table codes.
  useEffect(() => {
    if (
      lastErrorCode === 'not_found' ||
      lastErrorCode === 'kicked' ||
      lastErrorCode === 'bad_auth' ||
      lastErrorCode === 'account_deleted'
    ) {
      joinedRef.current = tableId; // mark as joined so interval stops thrashing
    }
  }, [lastErrorCode, tableId]);

  const send = useCallback((payload: unknown): boolean => sessionSocketSend(payload), []);

  const leaveTable = useCallback(() => {
    if (!tableId) return;
    joinedRef.current = null;
    sessionSocketSend({ type: 'leave_table', tableId });
    bindTable(null);
    setError(null);
  }, [tableId, bindTable, setError]);

  return { send, leaveTable };
}

/**
 * Watch a contest on the shared session socket.
 */
export function useContestSocket(contestId: string | null) {
  const connection = useSession((s) => s.connection);
  const ticket = useSession((s) => s.ticket);
  const joinedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!contestId || !ticket) return;

    joinedRef.current = null;
    const tryJoin = () => {
      if (useSession.getState().connection !== 'open') return;
      if (joinedRef.current === contestId) return;
      if (sessionSocketSend({ type: 'join_contest', contestId })) {
        joinedRef.current = contestId;
      }
    };
    tryJoin();
    const id = window.setInterval(tryJoin, 500);
    return () => {
      window.clearInterval(id);
      if (joinedRef.current === contestId) {
        sessionSocketSend({ type: 'leave_contest', contestId });
        joinedRef.current = null;
      }
      useSession.getState().clearContestWatch(contestId);
    };
  }, [contestId, ticket]);

  useEffect(() => {
    if (connection !== 'open' || !contestId || !ticket) return;
    if (sessionSocketSend({ type: 'join_contest', contestId })) {
      joinedRef.current = contestId;
    }
  }, [connection, contestId, ticket]);
}
