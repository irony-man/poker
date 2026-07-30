'use client';

import { useCallback, useEffect, useRef } from 'react';
import { emitSocketMessage } from './socketMessages';
import { WS_URL } from './api';
import { useSession, type PrivateView, type PublicTable } from './store';

const RECONNECT_DELAY_MS = 2_000;

export function usePokerSocket(
  tableId: string | null,
  opts?: { spectate?: boolean },
) {
  const spectate = opts?.spectate ?? false;
  const ticket = useSession((s) => s.ticket);
  const setConnection = useSession((s) => s.setConnection);
  const applyStateSync = useSession((s) => s.applyStateSync);
  const pushChat = useSession((s) => s.pushChat);
  const setError = useSession((s) => s.setError);
  const setEmoji = useSession((s) => s.setEmoji);
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalLeaveRef = useRef(false);
  const mountedRef = useRef(false);
  const spectateRef = useRef(spectate);
  spectateRef.current = spectate;

  useEffect(() => {
    if (!ticket || !tableId) return;

    mountedRef.current = true;
    intentionalLeaveRef.current = false;

    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!mountedRef.current || intentionalLeaveRef.current) return;

      setConnection('connecting');
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws!.send(JSON.stringify({ type: 'auth', ticket }));
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data));
        emitSocketMessage(msg);
        switch (msg.type) {
          case 'auth_ok':
            setConnection('open');
            ws!.send(
              JSON.stringify({
                type: 'join_table',
                tableId,
                ...(spectateRef.current ? { spectate: true } : {}),
              }),
            );
            break;
          case 'state_sync':
            applyStateSync(msg.table as PublicTable, (msg.private as PrivateView) ?? null);
            break;
          case 'chat':
            pushChat({
              userId: msg.userId,
              name: msg.name,
              text: msg.text,
              at: msg.at,
            });
            break;
          case 'emoji':
            setEmoji({ emoji: msg.emoji, name: msg.name, at: msg.at });
            setTimeout(() => setEmoji(null), 1800);
            break;
          case 'error':
            setError(
              typeof msg.message === 'string' ? msg.message : 'Error',
              typeof msg.code === 'string' ? msg.code : null,
            );
            if (msg.code === 'not_found') {
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
        wsRef.current = null;
        setConnection('closed');
        if (mountedRef.current && !intentionalLeaveRef.current) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => setError('WebSocket error');
    };

    connect();

    ping = setInterval(() => {
      const open = wsRef.current;
      if (open && open.readyState === WebSocket.OPEN) {
        open.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20_000);

    return () => {
      mountedRef.current = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ping) clearInterval(ping);
      // Drop socket only — server keeps the seat through a reconnect grace window.
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [ticket, tableId, setConnection, applyStateSync, pushChat, setError, setEmoji]);

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
    send({ type: 'leave_table', tableId });
    wsRef.current?.close();
  }, [send, tableId]);

  return { send, leaveTable };
}
