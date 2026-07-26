'use client';

import { useEffect, useRef } from 'react';
import { WS_URL } from './api';
import { useSession, type PrivateView, type PublicTable } from './store';

export function usePokerSocket(tableId: string | null) {
  const ticket = useSession((s) => s.ticket);
  const setConnection = useSession((s) => s.setConnection);
  const applyStateSync = useSession((s) => s.applyStateSync);
  const pushChat = useSession((s) => s.pushChat);
  const setError = useSession((s) => s.setError);
  const setEmoji = useSession((s) => s.setEmoji);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!ticket || !tableId) return;

    setConnection('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', ticket }));
    };

    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      switch (msg.type) {
        case 'auth_ok':
          setConnection('open');
          ws.send(JSON.stringify({ type: 'join_table', tableId }));
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
          setError(msg.message);
          break;
        default:
          break;
      }
    };

    ws.onclose = () => setConnection('closed');
    ws.onerror = () => setError('WebSocket error');

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);

    return () => {
      clearInterval(ping);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave_table', tableId }));
      }
      ws.close();
      wsRef.current = null;
    };
  }, [ticket, tableId, setConnection, applyStateSync, pushChat, setError, setEmoji]);

  const send = (payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  return { send };
}
