'use client';

import { useCallback, useEffect, useRef } from 'react';
import { emitSocketMessage } from './socketMessages';
import { WS_URL } from './api';
import { isSeatActionLabel } from '@/lib/seatAction';
import { useSession, type PrivateView, type PublicTable } from './store';

const RECONNECT_DELAY_MS = 2_000;

export function usePokerSocket(
  tableId: string | null,
  opts?: { spectate?: boolean },
) {
  const spectate = opts?.spectate ?? false;
  const ticket = useSession((s) => s.ticket);
  const setConnection = useSession((s) => s.setConnection);
  const bindTable = useSession((s) => s.bindTable);
  const applyStateSync = useSession((s) => s.applyStateSync);
  const pushChat = useSession((s) => s.pushChat);
  const setError = useSession((s) => s.setError);
  const setEmoji = useSession((s) => s.setEmoji);
  const setActionBurst = useSession((s) => s.setActionBurst);
  const setChipBalance = useSession((s) => s.setChipBalance);
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalLeaveRef = useRef(false);
  /** Bumps on every effect teardown so stale sockets never reconnect or apply state. */
  const epochRef = useRef(0);
  const spectateRef = useRef(spectate);
  const tableIdRef = useRef(tableId);
  const ticketRef = useRef(ticket);
  spectateRef.current = spectate;
  tableIdRef.current = tableId;
  ticketRef.current = ticket;

  useEffect(() => {
    if (!ticket || !tableId) return;

    intentionalLeaveRef.current = false;
    const epoch = ++epochRef.current;
    bindTable(tableId);

    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const isCurrent = () =>
      epoch === epochRef.current && !intentionalLeaveRef.current && tableIdRef.current === tableId;

    let emojiClearTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!isCurrent()) return;

      setConnection('connecting');
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isCurrent() || wsRef.current !== ws) {
          ws?.close();
          return;
        }
        const t = ticketRef.current;
        if (!t) return;
        ws!.send(JSON.stringify({ type: 'auth', ticket: t }));
      };

      ws.onmessage = (ev) => {
        if (!isCurrent() || wsRef.current !== ws) return;
        let msg: { type?: string; [key: string]: unknown };
        try {
          msg = JSON.parse(String(ev.data)) as { type?: string; [key: string]: unknown };
        } catch {
          return;
        }
        emitSocketMessage(msg);
        switch (msg.type) {
          case 'auth_ok': {
            setConnection('open');
            if (typeof msg.chipBalance === 'number') {
              setChipBalance(msg.chipBalance);
            }
            const id = tableIdRef.current;
            if (!id) return;
            ws!.send(
              JSON.stringify({
                type: 'join_table',
                tableId: id,
                ...(spectateRef.current ? { spectate: true } : {}),
              }),
            );
            break;
          }
          case 'wallet_update': {
            if (typeof msg.chipBalance === 'number') {
              setChipBalance(msg.chipBalance);
            }
            break;
          }
          case 'state_sync': {
            const table = msg.table as PublicTable;
            // Drop late packets after navigation / reconnect epoch change.
            if (table?.tableId !== tableIdRef.current) return;
            // #region agent log
            {
              const me = table?.players?.find((p) => p.userId && String(p.userId).length > 0);
              const stacks = (table?.players ?? [])
                .filter((p) => p.status !== 'empty')
                .map((p) => ({ seat: p.seat, stack: p.stack, status: p.status, userId: p.userId ? 'set' : null }));
              fetch('http://127.0.0.1:7727/ingest/74202427-8442-4104-883a-fdcf8ef5d80b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'61d007'},body:JSON.stringify({sessionId:'61d007',runId:'pre-fix',hypothesisId:'D',location:'ws.ts:state_sync',message:'incoming state_sync',data:{tableId:table?.tableId,version:table?.version,buyIn:table?.config?.buyIn,stacks,sampleMe:me?{stack:me.stack,status:me.status}:null},timestamp:Date.now()})}).catch(()=>{});
            }
            // #endregion
            applyStateSync(table, (msg.private as PrivateView) ?? null);
            break;
          }
          case 'chat':
            pushChat({
              userId: String(msg.userId ?? ''),
              name: String(msg.name ?? ''),
              text: String(msg.text ?? ''),
              at: typeof msg.at === 'number' ? msg.at : Date.now(),
            });
            break;
          case 'emoji':
            setEmoji({
              emoji: String(msg.emoji ?? ''),
              name: String(msg.name ?? ''),
              at: typeof msg.at === 'number' ? msg.at : Date.now(),
            });
            if (emojiClearTimer) clearTimeout(emojiClearTimer);
            emojiClearTimer = setTimeout(() => setEmoji(null), 1800);
            break;
          case 'seat_action': {
            const label =
              typeof msg.label === 'string' ? msg.label : String(msg.action ?? '');
            if (isSeatActionLabel(label)) {
              setActionBurst({
                seat: typeof msg.seat === 'number' ? msg.seat : 0,
                label,
                at: typeof msg.at === 'number' ? msg.at : Date.now(),
              });
            }
            break;
          }
          case 'error':
            setError(
              typeof msg.message === 'string' ? msg.message : 'Error',
              typeof msg.code === 'string' ? msg.code : null,
            );
            if (msg.code === 'not_found' || msg.code === 'kicked' || msg.code === 'bad_auth') {
              intentionalLeaveRef.current = true;
              if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
              }
              ws?.close();
            }
            break;
          default:
            break;
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        // Ignore closes from superseded sockets (Strict Mode remount / table switch).
        if (!isCurrent()) return;
        setConnection('closed');
        if (!intentionalLeaveRef.current) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => {
        if (!isCurrent() || wsRef.current !== ws) return;
        setError('WebSocket error');
      };
    };

    connect();

    ping = setInterval(() => {
      if (!isCurrent()) return;
      const open = wsRef.current;
      if (open && open.readyState === WebSocket.OPEN) {
        open.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20_000);

    return () => {
      epochRef.current += 1;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (emojiClearTimer) clearTimeout(emojiClearTimer);
      if (ping) clearInterval(ping);
      // Drop socket only — server keeps the seat through a reconnect grace window.
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onopen = null;
        ws.close();
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [
    ticket,
    tableId,
    bindTable,
    setConnection,
    applyStateSync,
    pushChat,
    setError,
    setEmoji,
    setActionBurst,
    setChipBalance,
  ]);

  const send = useCallback((payload: unknown): boolean => {
    const open = wsRef.current;
    if (open && open.readyState === WebSocket.OPEN) {
      open.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const leaveTable = useCallback(() => {
    if (!tableId) return;
    intentionalLeaveRef.current = true;
    epochRef.current += 1;
    send({ type: 'leave_table', tableId });
    const open = wsRef.current;
    if (open) {
      open.onclose = null;
      open.close();
      wsRef.current = null;
    }
    bindTable(null);
    setConnection('closed');
  }, [send, tableId, bindTable, setConnection]);

  return { send, leaveTable };
}
