'use client';
import { useEffect, useRef, useCallback } from 'react';
import { WSMessage } from '@/types';

const getWebSocketUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost:3001/ws';

  const configuredWsUrl = process.env.NEXT_PUBLIC_WS_URL;
  const isDeployedBrowser = !['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (configuredWsUrl && !(isDeployedBrowser && configuredWsUrl.includes('localhost'))) {
    return configuredWsUrl;
  }

  if (isDeployedBrowser) return null;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/_/backend/ws`;
};

export function useWebSocket(
  assignmentId: string | null,
  onMessage: (msg: WSMessage) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = getWebSocketUrl();
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (assignmentId) {
        ws.send(JSON.stringify({ type: 'subscribe', assignmentId }));
      }
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WSMessage;
        onMessage(msg);
      } catch {}
    };

    ws.onclose = () => {
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [assignmentId, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
