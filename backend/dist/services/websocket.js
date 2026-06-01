"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWebSocket = initWebSocket;
exports.notifyAssignmentUpdate = notifyAssignmentUpdate;
exports.broadcastToAll = broadcastToAll;
const ws_1 = require("ws");
let wss;
const clients = new Map();
function initWebSocket(server) {
    wss = new ws_1.WebSocketServer({ server, path: '/ws' });
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
            }
            catch { }
        });
        ws.on('close', () => {
            clients.delete(clientId);
        });
        ws.send(JSON.stringify({ type: 'connected', clientId }));
    });
    console.log('WebSocket server initialized');
}
function notifyAssignmentUpdate(assignmentId, payload) {
    clients.forEach(({ ws, assignmentId: subId }) => {
        if (subId === assignmentId && ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'assignment_update', assignmentId, ...payload }));
        }
    });
}
function broadcastToAll(payload) {
    clients.forEach(({ ws }) => {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(payload));
        }
    });
}
