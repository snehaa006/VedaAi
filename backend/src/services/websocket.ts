import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface WSClient {
  ws: WebSocket;
  assignmentId?: string;
}

let wss: WebSocketServer;
const clients = new Map<string, WSClient>();

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).slice(2);
    clients.set(clientId, { ws });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe' && msg.assignmentId) {
          const client = clients.get(clientId);
          if (client) {
            client.assignmentId = msg.assignmentId;
          }
        }
      } catch {}
    });

    ws.on('close', () => {
      clients.delete(clientId);
    });

    ws.send(JSON.stringify({ type: 'connected', clientId }));
  });

  console.log('WebSocket server initialized');
}

export function notifyAssignmentUpdate(assignmentId: string, payload: object) {
  clients.forEach(({ ws, assignmentId: subId }) => {
    if (subId === assignmentId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'assignment_update', assignmentId, ...payload }));
    }
  });
}

export function broadcastToAll(payload: object) {
  clients.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  });
}
