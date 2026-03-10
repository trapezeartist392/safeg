/**
 * SafeG AI — Backend Server
 * Entry point: bootstraps Express, WebSocket, and all middleware
 */
require('dotenv').config();
const http   = require('http');
const app    = require('./app');
const { initWebSocket } = require('./websocket/wsServer');
const { connectDB }     = require('./config/database');
const { connectRedis }  = require('./config/redis');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  try {
    // 1. Database
    await connectDB();
    logger.info('✅ PostgreSQL connected');

    // 2. Redis
    await connectRedis();
    logger.info('✅ Redis connected');

    // 3. HTTP + WebSocket server
    const server = http.createServer(app);
    initWebSocket(server);
    logger.info('✅ WebSocket server initialised');

    server.listen(PORT, () => {
      logger.info(`🚀 SafeG AI Backend running on port ${PORT}`);
      logger.info(`📖 Swagger docs: http://localhost:${PORT}/api/docs`);
      logger.info(`🔍 Health check: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => process.exit(0));
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();
