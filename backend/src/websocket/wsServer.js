/**
 * WebSocket Server
 * Real-time push for:
 *   - New violations
 *   - Camera status changes
 *   - PPE compliance KPI updates
 *   - Alert delivery confirmations
 */
const WebSocket = require('ws');
const jwt       = require('jsonwebtoken');
const { getSub } = require('../config/redis');
const logger    = require('../utils/logger');

const clients = new Map(); // tenantId → Set<WebSocket>

exports.initWebSocket = (server) => {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Authenticate via token in query string: /ws?token=xxx
    const url   = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    let tenantId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      tenantId = decoded.tid;
    } catch {
      ws.close(4001, 'Unauthorised');
      return;
    }

    // Register client
    if (!clients.has(tenantId)) clients.set(tenantId, new Set());
    clients.get(tenantId).add(ws);
    logger.info(`WS connected — tenant: ${tenantId} (${clients.get(tenantId).size} clients)`);

    ws.on('close', () => {
      clients.get(tenantId)?.delete(ws);
      logger.info(`WS disconnected — tenant: ${tenantId}`);
    });

    ws.on('error', (err) => logger.error('WS error:', err.message));

    // Send initial heartbeat
    ws.send(JSON.stringify({ type: 'connected', tenantId, timestamp: new Date().toISOString() }));
  });

  // Subscribe to Redis pub/sub channels
  const sub = getSub();

  const channels = ['violations', 'camera_health', 'ppe_events', 'alerts'];

  channels.forEach(ch => {
    sub.subscribe(ch, (message, channel) => {
      try {
        const data = JSON.parse(message);
        broadcast(data.tenantId || data.violation?.tenant_id, { type: channel, data });
      } catch (e) {
        logger.error(`WS broadcast parse error on ${channel}:`, e.message);
      }
    });
  });

  // Heartbeat ping every 30s to keep connections alive
  setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30000);

  logger.info('WebSocket server ready at ws://localhost/ws');
  return wss;
};

// Broadcast message to all connected clients of a tenant
function broadcast(tenantId, message) {
  const tenantClients = clients.get(tenantId);
  if (!tenantClients) return;

  const payload = JSON.stringify(message);
  tenantClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// Export for manual broadcasts from other services
exports.broadcast = broadcast;
